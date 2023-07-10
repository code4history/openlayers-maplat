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
import {XYZ} from 'ol/source.js';
import {polygon} from '@turf/helpers';

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

    if (!('url' in options)) {
      // @ts-ignore
      options.url = settings.sourceSpec
        ? settings.sourceSpec.url
        : settings.url;
    }

    //Set up Maplat projection
    const createdProjection = createProjection(settings, options);
    const maplatProjection = Array.isArray(createdProjection)
      ? createdProjection[0]
      : createdProjection;
    options.projection = maplatProjection;
    const source =
      maplatProjection.getUnits() === 'pixels'
        ? new Maplat(options)
        : new XYZ(options);
    source.set(
      'title',
      settings.metaData ? settings.metaData.title : settings.title
    );
    return source;
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

function createProjection(settings, options, subNum) {
  const maplatProjection = decideProjection(settings, options, subNum);
  if (
    maplatProjection.getCode() !== 'EPSG:3857' &&
    maplatProjectionStore.indexOf(maplatProjection.getCode()) < 0
  ) {
    const [toSystemFromMapTransform, fromSystemToMapTransform] =
      createSystem2MapTransformation(settings);
    const [toMapFromWarpTransformation, fromMapToWarpTransformation] =
      createMap2WarpTransformation(settings);
    const [toWarpFromOperationTransform, fromWarpToOperationTransform] =
      createWarp2OperationTransformation(settings);

    const [toOperationCoord, fromOperationCoord] = [
      (xy) => {
        const mapCoord = toSystemFromMapTransform(xy);
        const warpCoord = toMapFromWarpTransformation(mapCoord);
        const operationCoord = toWarpFromOperationTransform(warpCoord);
        return operationCoord;
      },
      (operationCoord) => {
        const warpCoord = fromWarpToOperationTransform(operationCoord);
        const mapCoord = fromMapToWarpTransformation(warpCoord);
        const xy = fromSystemToMapTransform(mapCoord);
        return xy;
      },
    ];

    addProjection(maplatProjection);
    // @ts-ignore
    addCoordinateTransforms(
      maplatProjection,
      'EPSG:3857',
      toOperationCoord,
      fromOperationCoord
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
    maplatProjectionStore.push(maplatProjection.getCode());
  }

  let returnProjs;
  if (settings.sub_maps) {
    returnProjs = settings.sub_maps.map((subMap, index) => {
      const subSettings = Object.assign(
        {
          mapID: settings.mapID,
        },
        subMap
      );
      const retProj = createProjection(subSettings, options, index + 1);
      //retProj.set('priority', subSettings.priority);
      //retProj.set('importance', subSettings.importance);
      return retProj;
    });
    returnProjs.unshift(maplatProjection);
  }
  if (maplatProjection.getUnits() !== 'pixels') {
    if (settings.envelopeLngLats) {
      const lnglats = settings.envelopeLngLats.concat([settings.envelopeLngLats[0]]);
      const coords3857 = lnglats.map((lnglat) => {
        return transform(lnglat, 'EPSG:4326', 'EPSG:3857');
      });
      maplatProjection.mercBoundary = polygon([coords3857]);
    }
  } else {
    if (settings.boundsPolygon) {
      maplatProjection.pixelBoundary = settings.boundsPolygon;
    } else {
      const xys = [
        [0, 0],
        [options.size[0], 0],
        options.size,
        [0, options.size[1]],
        [0, 0],
      ];
      maplatProjection.pixelBoundary = polygon([xys]);
    }
    maplatProjection.mercBoundary = polygon([
      maplatProjection.pixelBoundary.geometry.coordinates[0].map((xy) => {
        return transform(xy, maplatProjection, 'EPSG:3857');
      }),
    ]);
  }

  return returnProjs ? returnProjs : maplatProjection;
}

function decideProjection(settings, options, subNum = 0) {
  const projName = `Maplat:${settings.mapID}${subNum ? `#${subNum}` : ''}`;
  let projSelect = 'PIXEL';
  if (settingsIsLegacy(settings)) {
    if (settingsIs3857OnLegacy(settings)) {
      options.maxZoom = settings.maxZoom;
      projSelect = settingsIsNoWarpOnLegacy3857(settings) ? '3857' : '3857+';
    }
  } else if (settingsIs3857(settings)) {
    options.maxZoom = settings.maxZoom;
    projSelect = settingsIsNoWarp(settings) ? '3857' : '3857+';
  }
  let returnProj;
  switch (projSelect) {
    case '3857':
      returnProj = getProjection('EPSG:3857');
      break;
    case '3857+':
      returnProj = new Projection({
        code: projName,
        units: 'm',
        extent: [
          -20037508.342789244, -20037508.342789244, 20037508.342789244,
          20037508.342789244,
        ],
        worldExtent: [-180, -85, 180, 85],
      });
      break;
    default:
      if (!('size' in options)) {
        options.size =
          'projectionSpec' in settings
            ? settings.projectionSpec.size
            : 'width' in settings && 'height' in settings
            ? [settings.width, settings.height]
            : // @ts-ignore
              settings.compiled.wh;
      }
      options.maxZoom = Math.ceil(
        Math.max(
          Math.log2(options.size[0] / 256),
          Math.log2(options.size[1] / 256)
        )
      );
      const extent = [0, -options.size[1], options.size[0], 0];
      const worldExtentSize = 256 * Math.pow(2, options.maxZoom);
      const worldExtent = [0, -worldExtentSize, worldExtentSize, 0];
      returnProj = new Projection({
        code: projName,
        units: 'pixels',
        extent: extent,
        worldExtent: worldExtent,
      });
  }

  return returnProj;
}

function createSystem2MapTransformation(settings) {
  if (settingsIsLegacy(settings)) {
    return [coord2Coord, coord2Coord];
  }
  if (settingsHasWorldParams(settings)) {
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
  if (settingsIsLegacy(settings)) {
    if (settingsIs3857OnLegacy(settings)) {
      if (settingsIsNoWarpOnLegacy3857(settings)) {
        return [coord2Coord, coord2Coord];
      }
      const shiftX = settings.mercatorXShift;
      const shiftY = settings.mercatorYShift;
      return [
        (xy) => {
          return [xy[0] + shiftX, xy[1] + shiftY];
        },
        (xy) => {
          return [xy[0] - shiftX, xy[1] - shiftY];
        },
      ];
    }
    const tin = new Tin();
    tin.setCompiled(settings.compiled);
    return [
      (xy) => tin.transform([xy[0], -xy[1]], false),
      (merc) => {
        const xy = tin.transform(merc, true);
        return [xy[0], -xy[1]];
      },
    ];
  }
  switch (settings.projectionSpec.warp) {
    case 'TIN':
      // TIN処理
      return [coord2Coord, coord2Coord];
    case 'SHIFT':
      const coordShift = settings.projectionSpec.coordShift;
      return [
        (xy) => {
          return [xy[0] + coordShift[0], xy[1] + coordShift[1]];
        },
        (xy) => {
          return [xy[0] - coordShift[0], xy[1] - coordShift[1]];
        },
      ];
    default:
      return [coord2Coord, coord2Coord];
  }
}

function createWarp2OperationTransformation(settings) {
  if (settingsIsLegacy(settings)) {
    return [coord2Coord, coord2Coord];
  }
  const projectionSpec = settings.projectionSpec;
  if (projectionSpec.mapCoord === 'PIXEL') {
    return [coord2Coord, coord2Coord];
  }
  if (projectionSpec.mapCoord.match(/^(JCP:ZONE[ABC])/)) {
    const zone = RegExp.$1;
    const map2nad = proj4(`${zone}:NAD27`, 'JCP:NAD27');
    const tky2merc = proj4('TOKYO', 'EPSG:3857');
    return [
      (xy) => {
        const tokyo = map2nad.forward(xy);
        const merc = tky2merc.forward(tokyo);
        return merc;
      },
      (merc) => {
        const tokyo = tky2merc.inverse(merc);
        const xy = map2nad.inverse(tokyo);
        return xy;
      },
    ];
  }
  if (projectionSpec.mapCoord.match(/^EPSG:\d+$/)) {
    const epsg = projectionSpec.mapCoord;
    if (!proj4.defs(epsg)) {
      if (projectionSpec.mapCoordText) {
        proj4.defs(epsg, projectionSpec.mapCoordText);
      } else {
        throw new Error(`Unsupported projection by proj4: ${epsg}`);
      }
    }
    const map2merc = proj4(epsg, 'EPSG:3857');
    return [
      (xy) => {
        const merc = map2merc.forward(xy);
        return merc;
      },
      (merc) => {
        const xy = map2merc.inverse(merc);
        return xy;
      },
    ];
  }
  throw new Error(`Cannot handle projection: ${projectionSpec.mapCoord}`);
}

function coord2Coord(xy) {
  return xy;
}

function settingsIsLegacy(settings) {
  return !('version' in settings);
}

function settingsIs3857OnLegacy(settings) {
  return (
    settings.maptype === 'base' ||
    settings.maptype === 'overlay' ||
    settings.maptype === 'mapbox'
  );
}

function settingsIsNoWarpOnLegacy3857(settings) {
  return !('mercatorXShift' in settings && 'mercatorYShift' in settings);
}

function settingsIs3857(settings) {
  return (
    settings.projectionSpec &&
    settings.projectionSpec.mapCoord === 'EPSG:3857' &&
    (settings.sourceSpec.tileSourceType === 'WMTS' ||
      settings.sourceSpec.tileSourceType === 'TMS')
  );
}

function settingsIsNoWarp(settings) {
  return settings.projectionSpec && settings.projectionSpec.warp === 'NONE';
}

function settingsHasWorldParams(settings) {
  return settings.projectionSpec && settings.projectionSpec.worldParams;
}

export default Factory;
