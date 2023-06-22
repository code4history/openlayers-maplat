/**
 * @module ol/maplat/source/Maplat
 */
import Tin from '@maplat/tin/lib/index.js';
import Zoomify from '../../source/Zoomify.js';
import proj4 from 'proj4';
import {
  Projection,
  addCoordinateTransforms,
  addProjection,
  get as getProjection,
  transform,
} from '../../proj.js';
proj4.defs([
  ['TOKYO', '+proj=longlat +ellps=bessel +towgs84=-146.336,506.832,680.254'],
  ['JCP:NAD27', '+proj=longlat +ellps=clrk66 +datum=NAD27 +no_defs'],
  [
    'JCP:ZONEA:NAD27',
    '+proj=poly +lat_0=40.5 +lon_0=143 +x_0=914398.5307444408 +y_0=1828797.0614888816 +ellps=clrk66 +to_meter=0.9143985307444408 +no_defs',
  ],
  [
    'JCP:ZONEB:NAD27',
    '+proj=poly +lat_0=40.5 +lon_0=135 +x_0=914398.5307444408 +y_0=1828797.0614888816 +ellps=clrk66 +to_meter=0.9143985307444408 +no_defs',
  ],
  [
    'JCP:ZONEC:NAD27',
    '+proj=poly +lat_0=40.5 +lon_0=127 +x_0=914398.5307444408 +y_0=1828797.0614888816 +ellps=clrk66 +to_meter=0.9143985307444408 +no_defs',
  ],
]);

/**
 * @typedef {Object} maplatOptions
 * @property {import("../../source/Source.js").AttributionLike} [attributions] Attributions.
 * @property {number} [cacheSize] Initial tile cache size. Will auto-grow to hold at least the number of tiles in the viewport.
 * @property {null|string} [crossOrigin] The `crossOrigin` attribute for loaded images.  Note that
 * you must provide a `crossOrigin` value  you want to access pixel data with the Canvas renderer.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image for more detail.
 * @property {boolean} [interpolate=true] Use interpolated values when resampling.  By default,
 * linear interpolation is used when resampling.  Set to false to use the nearest neighbor instead.
 * @property {number} [tilePixelRatio] The pixel ratio used by the tile service. For example, if the tile service advertizes 256px by 256px tiles but actually sends 512px by 512px images (for retina/hidpi devices) then `tilePixelRatio` should be set to `2`
 * @property {number} [reprojectionErrorThreshold=0.5] Maximum allowed reprojection error (in pixels).
 * Higher values can increase reprojection performance, but decrease precision.
 * @property {string} url URL template of the Maplat tile.
 * @property {import("../../size.js").Size} size Size.
 * @property {number} [transition] Duration of the opacity transition for rendering.
 * To disable the opacity transition, pass `transition: 0`.
 * @property {number} [tileSize=256] Tile size. Same tile size is used for all zoom levels.
 * @property {number|import("../../array.js").NearestDirectionFunction} [zDirection=0]
 * Choose whether to use tiles with a higher or lower zoom level when between integer
 * zoom levels. See {@link module:ol/tilegrid/TileGrid~TileGrid#getZForResolution}.
 * @property {import("@maplat/tin/lib/index.js").Compiled} [tinCompiled] Compiled data of Maplat TIN (Triangle Irregular Network) setting.
 * @property {string} [mapID] Map ID of Maplat data.
 * @property {import("@maplat/tin/lib/index.js").Options} settings Setting of Tin.
 */

/**
 * @private
 * @type {Array<string>}
 */
const maplatProjectionStore = [];

/**
 * @classdesc
 * Layer source for tile data in Maplat Legacy format.
 * @api
 */
class Maplat extends Zoomify {
  /**
   * @param {maplatOptions} options Options.
   */
  constructor(options) {
    const settings = options.settings;
    // @ts-ignore
    const title = settings.title;
    // @ts-ignore
    const size = settings.width
      ? [settings.width, settings.height]
      : settings.compiled.wh;
    // @ts-ignore
    const url = settings.url;

    //Set up Maplat TIN
    const maxZoom = Math.ceil(
      Math.max(Math.log2(size[0] / 256), Math.log2(size[1] / 256))
    );
    const extent = [0, -size[1], size[0], 0];
    const worldExtentSize = 256 * Math.pow(2, maxZoom);
    const worldExtent = [0, -worldExtentSize, worldExtentSize, 0];
    const mapID = options.mapID;

    //Set up Maplat projection
    let maplatProjection;
    const maplatProjectionCode = `Maplat:${mapID}`;
    if (maplatProjectionStore.indexOf(maplatProjectionCode) < 0) {
      const [toBase, fromBase] = !settings.version
        ? createMaplatLegacy(settings)
        : createWorldFileBase(settings);
      maplatProjection = new Projection({
        code: maplatProjectionCode,
        units: 'pixels',
        extent: extent,
        worldExtent: worldExtent,
      });
      addProjection(maplatProjection);
      addCoordinateTransforms(
        maplatProjection,
        'EPSG:3857',
        // @ts-ignore
        toBase,
        fromBase
      );
      addCoordinateTransforms(
        maplatProjection,
        'EPSG:4326',
        (xy) =>
          transform(
            transform(xy, maplatProjection, 'EPSG:3857'),
            'EPSG:3857',
            'EPSG:4326'
          ),
        (lnglat) =>
          transform(
            transform(lnglat, 'EPSG:4326', 'EPSG:3857'),
            'EPSG:3857',
            maplatProjection
          )
      );
      maplatProjectionStore.forEach((projectionCode) => {
        addCoordinateTransforms(
          maplatProjection,
          projectionCode,
          (xy) =>
            transform(
              transform(xy, maplatProjection, 'EPSG:3857'),
              'EPSG:3857',
              projectionCode
            ),
          (xy) =>
            transform(
              transform(xy, projectionCode, 'EPSG:3857'),
              'EPSG:3857',
              maplatProjection
            )
        );
      });
      maplatProjectionStore.push(maplatProjectionCode);
    } else {
      maplatProjection = getProjection(maplatProjectionCode);
    }

    super({
      attributions: options.attributions,
      cacheSize: options.cacheSize,
      crossOrigin: options.crossOrigin,
      interpolate: options.interpolate,
      projection: maplatProjection,
      extent: extent,
      size: size,
      url: '',
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      transition: options.transition,
    });

    // @ts-ignore
    this.set('title', title);
    this.setTileUrlFunction((tileCoord) =>
      url
        .replace('{z}', `${tileCoord[0]}`)
        .replace('{x}', `${tileCoord[1]}`)
        .replace('{y}', `${tileCoord[2]}`)
    );
  }

  static async init(options) { }
}

function createMaplatLegacy(settings) {
  const tin = new Tin();
  // @ts-ignore
  tin.setCompiled(settings.compiled);

  return [
    (xy) => tin.transform([xy[0], -xy[1]], false),
    (merc) => {
      const xy = tin.transform(merc, true);
      return [xy[0], -xy[1]];
    },
  ];
}

function createWorldFileBase(settings) {
  const mapCoordParams = settings.mapCoordParams;
  const a = mapCoordParams.xScale;
  const b = mapCoordParams.xRotation;
  const c = mapCoordParams.xOrigin;
  const d = mapCoordParams.yRotation;
  const e = mapCoordParams.yScale;
  const f = mapCoordParams.yOrigin;
  const toMapCoord = (xy) => {
    return [a * xy[0] - b * xy[1] + c, d * xy[0] - e * xy[1] + f];
  };
  const fromMapCoord = (xy) => {
    return [
      (xy[0] * e - xy[1] * b - c * e + f * b) / (a * e - b * d),
      -(xy[1] * a - xy[0] * d - f * a + c * d) / (a * e - b * d),
    ];
  };

  const map2nad = proj4('JCP:ZONEB:NAD27', 'JCP:NAD27');
  const tky2merc = proj4('TOKYO', 'EPSG:3857');
  return [
    (xy) => {
      const mapCoord = toMapCoord(xy);
      const tokyo = map2nad.forward(mapCoord);
      const merc = tky2merc.forward(tokyo);
      return merc;
    },
    (merc) => {
      const tokyo = tky2merc.inverse(merc);
      const mapCoord = map2nad.inverse(tokyo);
      const xy = fromMapCoord(mapCoord);
      return xy;
    },
  ];
}

export default Maplat;
