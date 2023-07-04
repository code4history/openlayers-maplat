/**
 * @module ol/maplat/source/Factory
 */
import Maplat from './Maplat.js';
import Tin from '@maplat/tin/lib/index.js';
import proj4 from 'proj4';
import {
  Projection,
  addCoordinateTransforms,
  addProjection,
  get as getProjection,
  transform,
} from 'ol/proj.js';

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
 * @private
 * @type {Array<string>}
 */
const maplatProjectionStore = [];

class Factory {
  /**
   * @param {MaplatDefinition | MaplatSpecLegacy} settings Settings of Maplat
   * @param {import('./Maplat.js').Options} options Options for ol/source/TileImage
   * @return {import('./Maplat.js').default} Maplat instance
   */
  // @ts-ignore
  static factoryMaplatSource(settings, options = {}) {
    const mapID = settings.mapID;
    options.mapID = mapID;
    let size;

    if (!('size' in options)) {
      size =
        'width' in settings && 'height' in settings
          ? [settings.width, settings.height]
          : // @ts-ignore
            settings.compiled.wh;
      // @ts-ignore
      options.size = size;
    }
    if (!('url' in options)) {
      // @ts-ignore
      options.url = settings.url;
    }

    const maxZoom = Math.ceil(
      Math.max(
        Math.log2(options.size[0] / 256),
        Math.log2(options.size[1] / 256)
      )
    );
    const extent = [0, -options.size[1], options.size[0], 0];
    const worldExtentSize = 256 * Math.pow(2, maxZoom);
    const worldExtent = [0, -worldExtentSize, worldExtentSize, 0];
    options.extent = extent;
    options.worldExtent = worldExtent;

    //Set up Maplat projection
    let maplatProjection;
    const maplatProjectionCode = decideProjectionName(settings);
    if (
      maplatProjectionCode !== 'EPSG:3857' &&
      maplatProjectionStore.indexOf(maplatProjectionCode) < 0
    ) {
      const [toSystemFromMapTransform, fromSystemToMapTransform] =
        createSystem2MapTransformation(settings);
      const [toMapFromWarpTransformation, fromMapToWarpTransformation] =
        createMap2WarpTransformation(settings);
      const [toWarpFromOperationTransform, fromWarpToOperationTransform] =
        createWarp2OperationTransformation(settings);

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
      // @ts-ignore
      addCoordinateTransforms(maplatProjection, 'EPSG:3857', toBase, fromBase);
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



    return new Maplat(options);
  }

  /**
   * @param {string} mapID ID of Map
   * @param {string} url URL of Map tile
   * @param {import('./Maplat.js').Options} options Options for ol/source/TileImage
   * @return {Promise<import('./Maplat.js').default>} Maplat instance
   */
  // @ts-ignore
  static async factoryMaplatSourceFromUrl(mapID, url, options = {}) {
    const settingsReq = await fetch(url);
    const settings = await settingsReq.json();

    if (!mapID) {
      if (settings.mapID) {
        mapID = settings.mapID;
      } else {
        const mapDivide = url.split(/[\/\.]/);
        mapID = mapDivide[mapDivide.length - 2];
      }
    }
    settings.mapID = mapID;

    return this.factoryMaplatSource(settings, options);
  }
}

function decideProjectionName(settings) {
  const projName = `Maplat:${settings.mapID}`;
  if (!settings.version) {
    if (
      settings.maptype === 'base' ||
      settings.maptype === 'overlay' ||
      settings.maptype === 'mapbox'
    ) {
      return 'EPSG:3857';
    }
    return projName;
  }
  if (
    settings.projectionSpec.mapCoord === 'EPSG:3857' &&
    (settings.sourceSpec.tileSourceType === 'WMTS' ||
      settings.sourceSpec.tileSourceType === 'TMS') &&
    settings.projectionSpec.warp === 'NONE'
  ) {
    return 'EPSG:3857';
  }
  return projName;
}

function createSystem2MapTransformation(settings) {
  if (!settings.version) {
    return [coord2Coord, coord2Coord];
  }
  if (settings.projectionSpec.worldParams) {
    const worldParams = settings.projectionSpec.worldParams;
    const a = worldParams.xScale;
    const b = worldParams.xRotation;
    const c = worldParams.xOrigin;
    const d = worldParams.yRotation;
    const e = worldParams.yScale;
    const f = worldParams.yOrigin;
    return [
      (xy) => {
        return [a * xy[0] - b * xy[1] + c, d * xy[0] - e * xy[1] + f];
      },
      (xy) => {
        return [
          (xy[0] * e - xy[1] * b - c * e + f * b) / (a * e - b * d),
          -(xy[1] * a - xy[0] * d - f * a + c * d) / (a * e - b * d),
        ];
      },
    ];
  }
  return [coord2Coord, coord2Coord];
}

function createMap2WarpTransformation(settings) {
  return [,];
}

function createWarp2OperationTransformation(settings) {
  return [,];
}

function coord2Coord(xy) {
  return xy;
}

export default Factory;
