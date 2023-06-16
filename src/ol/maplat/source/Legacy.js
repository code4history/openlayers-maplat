/**
 * @module ol/maplat/source/Legacy
 */
import Tin from '@maplat/tin/lib';
import Zoomify from '../../source/Zoomify.js';
import {
  Projection,
  addCoordinateTransforms,
  addProjection,
  get as getProjection,
  transform,
} from '../../proj.js';

/**
 * @typedef {Object} Options
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
 * @property {import("@maplat/tin/lib").Compiled} [tinCompiled] Compiled data of Maplat TIN (Triangle Irregular Network) setting.
 * @property {string} [mapID] Map ID of Maplat data.
 */

/**
 * @private
 * @type {string[]}
 */
const maplatProjectionStore = [];

/**
 * @classdesc
 * Layer source for tile data in Maplat Legacy format.
 * @api
 */
class Legacy extends Zoomify {
  /**
   * @param {Options} options Options.
   */
  constructor(options) {
    //Set up Maplat TIN
    const size = options.size;
    const maxZoom = Math.ceil(
      Math.max(Math.log2(size[0] / 256), Math.log2(size[1] / 256))
    );
    const extent = [0, -size[1], size[0], 0];
    const worldExtentSize = 256 * Math.pow(2, maxZoom);
    const worldExtent = [0, -worldExtentSize, worldExtentSize, 0];
    const url = options.url;
    const tin = new Tin();
    tin.setCompiled(options.tinCompiled);
    const mapID = options.mapID;

    //Set up Maplat projection
    let maplatProjection;
    const maplatProjectionCode = `Maplat:${mapID}`;
    if (maplatProjectionStore.indexOf(maplatProjectionCode) < 0) {
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
        (xy) => tin.transform([xy[0], -xy[1]], false),
        (merc) => {
          const xy = tin.transform(merc, true);
          return [xy[0], -xy[1]];
        }
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
    this.setTileUrlFunction((tileCoord) =>
      url
        .replace('{z}', `${tileCoord[0]}`)
        .replace('{x}', `${tileCoord[1]}`)
        .replace('{y}', `${tileCoord[2]}`)
    );
  }

  static async init(options) {}
}

export default Legacy;
