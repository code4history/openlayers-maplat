import FormatGeoJSON from '../src/ol/format/GeoJSON.js';
import FormatKML from '../src/ol/format/KML.js';
import LayerGroup from '../src/ol/layer/Group.js';
import Map from '../src/ol/Map.js';
import MaplatSource from '../src/ol/maplat/source/Maplat.js';
import VectorLayer from '../src/ol/layer/Vector.js';
import VectorSource from '../src/ol/source/Vector.js';
import View from '../src/ol/View.js';
import WebGLTileLayer from '../src/ol/layer/WebGLTile.js';
import clusterRegister from '../src/ol/maplat/clusterRegister.js';
import localeSelector from '../src/ol/maplat/locale/selector.js';
import vectorFilter from '../src/ol/maplat/vector/filter.js';
import viewportSwitcher from '../src/ol/maplat/viewport/switcher.js';
import {DragRotate} from '../src/ol/interaction.js';
import {Icon, Stroke, Style} from '../src/ol/style.js';
import {altKeyOnly} from '../src/ol/events/condition.js';
import {defaults} from '../src/ol/interaction/defaults.js';
import {transform} from '../src/ol/proj.js';

const centerLngLat = [139.53671, 36.24668];

const createMaplatSource = async (url) => {
  const settingsReq = await fetch(url);
  const settings = await settingsReq.json();

  const mapDivide = url.split(/[\/\.]/);
  const mapID = mapDivide[mapDivide.length - 2];
  const maplatSource = new MaplatSource({
    title: settings.title,
    size: settings.compiled.wh || [settings.width, settings.height],
    url: settings.url,
    tinCompiled: settings.compiled,
    mapID: mapID,
  });

  return maplatSource;
};

const createPoiSource = async (url) => {
  const vectorReq = await fetch(url);
  const vectorJSON = await vectorReq.json();
  const vectorSource = new VectorSource({
    features: new FormatGeoJSON().readFeatures(vectorJSON, {
      featureProjection: 'EPSG:4326',
      dataProjection: 'EPSG:4326',
    }),
  });
  return vectorSource;
};

const createKmlSource = async (url) => {
  const contourReq = await fetch(url);
  const contourText = await contourReq.text();
  const contourSource = new VectorSource({
    features: new FormatKML().readFeatures(contourText, {
      featureProjection: 'EPSG:4326',
      dataProjection: 'EPSG:4326',
    }),
  });
  return contourSource;
};

const stockIconHash = {};
const stockIconStyle = (clusterMember) => {
  // eslint-disable-next-line no-undef
  const key = iconSelector(clusterMember);
  if (!stockIconHash[key]) {
    stockIconHash[key] = new Icon({
      src: key,
      anchor: [0.5, 1.0],
    });
  }
  return new Style({
    geometry: clusterMember.getGeometry(),
    image: stockIconHash[key],
  });
};

const dataSources = [
  {
    area: '館林',
    raster: [
      'https://s.maplat.jp/r/tatebayashimap/maps/tatebayashi_ojozu.json',
      'https://s.maplat.jp/r/tatebayashimap/maps/tatebayashi_castle_akimoto.json',
      'https://s.maplat.jp/r/tatebayashimap/maps/tatebayashi_satonuma_village_1.json',
    ],
    vector: [
      {
        url: 'data/kml/yagoe_contour.kml',
        type: 'kml',
      },
      {
        url: 'https://raw.githubusercontent.com/code4history/TatebayashiStones/master/tatebayashi_stones.geojson',
        type: 'geojson',
        style: stockIconStyle,
      },
    ],
  },
  {
    area: '奈良',
    raster: [
      'https://s.maplat.jp/r/naramap/maps/nara_saiken_ndl.json',
      'https://s.maplat.jp/r/naramap/maps/nara_ezuya.json',
    ],
    vector: [
      {
        url: 'https://raw.githubusercontent.com/code4history/JizoProject/master/jizo_project.geojson',
        type: 'geojson',
        // eslint-disable-next-line no-undef
        style: stockIconStyle,
      },
    ],
  },
  {
    area: '姫路',
  },
];
await Promise.all(
  dataSources.map(async (dataSource) => {
    if (dataSource.raster) {
      dataSource.raster = await Promise.all(
        dataSource.raster.map((url) => createMaplatSource(url))
      );
    }
    if (dataSource.vector) {
      dataSource.vector = await Promise.all(
        dataSource.vector.map(async (vector) => {
          const source =
            vector.type == 'geojson'
              ? await createPoiSource(vector.url)
              : await createKmlSource(vector.url);
          return {
            source: source,
            style: vector.style,
          };
        })
      );
    }
  })
);

let map;

const areaSelect = document.getElementById('area_select');
const layerSelect = document.getElementById('layer_select');
areaSelect.onchange = function () {
  const area = areaSelect.value;
  // eslint-disable-next-line no-console
  areaSelectFunc(area * 1);
};
layerSelect.onchange = function () {
  const layer = layerSelect.value;
  // eslint-disable-next-line no-console
  layerSelectFunc(layer * 1);
};
let areaOptions = '';
dataSources.forEach((data, index) => {
  areaOptions = `${areaOptions}<option value="${index}">${data.area}</option>`;
});
areaSelect.innerHTML = areaOptions;
areaSelectFunc(0);

function areaSelectFunc(area_id) {
  const areaData = dataSources[area_id];
  let layerOptions = '';
  areaData.raster.forEach((raster, index) => {
    layerOptions = `${layerOptions}<option value="${index}">${localeSelector(
      raster.get('title'),
      'ja'
    )}</option>`;
  });
  layerSelect.innerHTML = layerOptions;
  layerSelectFunc(0, true);
}

function layerSelectFunc(layer_id, clearMap) {
  const area_id = areaSelect.value * 1;
  const areaData = dataSources[area_id];

  const fromSource =
    clearMap || !map ? null : map.getLayers().getArray()[0].getSource();
  const toSource = areaData.raster[layer_id];

  let toCenter, toResolution, toRotation, toParam;
  if (!fromSource) {
    toParam = {
      center: transform(centerLngLat, 'EPSG:4326', toSource.getProjection()),
      rotation: 0,
      zoom: 0,
    };
  } else {
    const fromView = map.getView();
    const fromCenter = fromView.getCenter();
    const fromRotation = fromView.getRotation();
    const fromResolution = fromView.getResolution();
    [toCenter, toRotation, toResolution] = viewportSwitcher(
      fromCenter,
      fromRotation,
      fromResolution,
      500,
      fromSource.getProjection(),
      toSource.getProjection()
    );
    toParam = {
      center: toCenter,
      rotation: toRotation,
      resolution: toResolution,
    };
  }
  toParam = Object.assign(toParam, {
    projection: toSource.getProjection(),
    constrainRotation: false,
  });
  const view = new View(toParam);

  let addMapToCluster;
  const layers = areaData.vector.map((vector) => {
    const source = vector.source;
    const filteredSource = vectorFilter(source, {
      projectTo: toSource.getProjection(),
      extent: toSource.getProjection().getExtent(),
    });
    if (vector.style) {
      const clusterLayer = new clusterRegister({});
      addMapToCluster = () => {
        clusterLayer.registerMap(filteredSource, map, vector.style);
      };
      return clusterLayer;
    }
    return new VectorLayer({
      source: filteredSource,
    });
  });

  layers.unshift(
    new WebGLTileLayer({
      title: localeSelector(toSource.get('title'), 'ja'),
      source: toSource,
    })
  );

  if (!map) {
    map = new Map({
      target: 'map',
      layers: layers,
      view: view,
      interactions: defaults({altShiftDragRotate: false}).extend([
        new DragRotate({condition: altKeyOnly}),
      ]),
    });
  } else {
    map.getLayers().forEach((layer) => {
      if (layer.removeMap) {
        layer.removeMap();
      }
    });
    map.setLayers(layers);
    map.setView(view);
  }
  if (addMapToCluster) {
    addMapToCluster();
  }
  if (!fromSource) {
    view.fit(toSource.getProjection().getExtent(), {padding: [50, 50, 50, 50]});
  }
}
