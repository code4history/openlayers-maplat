import Map from '../src/ol/Map.js';
import View from '../src/ol/View.js';
import WebGLTileLayer from '../src/ol/layer/WebGLTile.js';
import { transform } from '../src/ol/proj.js';
import { defaults } from '../src/ol/interaction/defaults.js';
import { DragRotate } from '../src/ol/interaction.js';
import { altKeyOnly } from '../src/ol/events/condition.js';
import LegacySource from '../src/ol/maplat/source/Legacy.js';
import VectorSource from '../src/ol/source/Vector.js';
import FormatGeoJSON from '../src/ol/format/GeoJSON.js';
import FormatKML from '../src/ol/format/KML.js';
import { Style, Icon, Stroke } from '../src/ol/style.js';
import vectorFilter from '../src/ol/maplat/vector/filter.js';
import clusterRegister from '../src/ol/maplat/clusterRegister.js';
import viewportSwitcher from "../src/ol/maplat/viewport/switcher.js";
import VectorLayer from '../src/ol/layer/Vector.js';

const centerLngLat = [139.536710, 36.246680];

const createSourceFunc = async (url) => {
  const settingsReq = await fetch(url);
  const settings = await settingsReq.json();

  const mapDivide = url.split(/[\/\.]/);
  const mapID = mapDivide[mapDivide.length - 2];
  const maplatSource = new LegacySource({
    size: [settings.width, settings.height],
    url: settings.url,
    tinCompiled: settings.compiled,
    mapID: mapID
  });

  return maplatSource;
};

const [ojozuSource, akimotoSource] = await Promise.all([
  "https://s.maplat.jp/r/tatebayashimap/maps/tatebayashi_ojozu.json", 
  "https://s.maplat.jp/r/tatebayashimap/maps/tatebayashi_castle_akimoto.json"
].map(async url => createSourceFunc(url)));

const vectorReq = await fetch("https://raw.githubusercontent.com/code4history/TatebayashiStones/master/tatebayashi_stones.geojson");
const vectorJSON = await vectorReq.json();
const vectorSource = new VectorSource({
  features: new FormatGeoJSON().readFeatures(vectorJSON, {
    featureProjection: "EPSG:4326",
    dataProjection: "EPSG:4326"
  })
});
const contourReq = await fetch("data/kml/yagoe_contour.kml");
const contourText = await contourReq.text();
const contourSource = new VectorSource({
  features: new FormatKML().readFeatures(contourText, {
    featureProjection: "EPSG:4326",
    dataProjection: "EPSG:4326"
  })
});
console.log(contourText);
console.log(contourSource);
contourSource.forEachFeature((f) => {
  console.log(f);
});

const stockIconHash = {};
const stockIconStyle = (clusterMember) => {
  const key = iconSelector(clusterMember);
  if (!stockIconHash[key]) {
    stockIconHash[key] = new Icon({
      src: key,
      anchor: [0.5, 1.0]
    });
  }
  return new Style({
    geometry: clusterMember.getGeometry(),
    image: stockIconHash[key]
  });;
};

let map;

const sourceChange = (isOjozu) => {
  const fromSource = isOjozu ? akimotoSource : ojozuSource;
  const toSource = isOjozu ? ojozuSource : akimotoSource;
  let toCenter, toResolution, toRotation, toParam;
  if (!map) {
    toParam = {
      center: transform(centerLngLat,"EPSG:4326", toSource.getProjection()),
      rotation: 0,
      zoom: 0
    };
  } else {
    const fromView = map.getView();
    const fromCenter = fromView.getCenter();
    const fromRotation = fromView.getRotation();
    const fromResolution = fromView.getResolution();
    [toCenter, toRotation, toResolution] = viewportSwitcher(fromCenter, fromRotation, fromResolution,
      500, fromSource.getProjection(), toSource.getProjection());
    toParam = {
      center: toCenter,
      rotation: toRotation,
      resolution: toResolution
    };
  }
  toParam = Object.assign(toParam, {
    projection: toSource.getProjection(),
    constrainRotation: false
  });

  const filteredVector = vectorFilter(vectorSource, {
    projectTo: toSource.getProjection(),
    extent: toSource.getProjection().getExtent()
  });
  const filteredContour = vectorFilter(contourSource, {
    projectTo: toSource.getProjection(),
    extent: toSource.getProjection().getExtent()
  });
  const layerContour = new VectorLayer({
    source: filteredContour,
    style: new Style({
      stroke: new Stroke({
        color: 'rgba(255, 255, 255, 0.7)',
        width: 2,
      }),
    }),
  });
  const clusterLayer = new clusterRegister({
  });
  const view = new View(toParam);

  if (!map) {
    map = new Map({
      target : 'map',
      layers: [
        new WebGLTileLayer({
          title: "館林御城図",
          source: toSource
        }),
        layerContour,
        clusterLayer
      ],
      view: view,
      interactions: defaults({altShiftDragRotate: false}).extend([
        new DragRotate({condition: altKeyOnly})
      ])
    });
    view.fit(toSource.getProjection().getExtent(), {/*duration: 500, */padding: [50, 50, 50, 50]});
  } else {
    map.getLayers().item(2).removeMap();
    map.setLayers([
      new WebGLTileLayer({
        title: "館林御城図",
        source: toSource
      }),
      layerContour,
      clusterLayer
    ]);
    map.setView(view);
  }

  clusterLayer.registerMap(filteredVector, map, stockIconStyle);
};


sourceChange(true);

document.getElementById('ojozu').onclick = function () {
  sourceChange(true);
};

document.getElementById('akimoto').onclick = function () {
  sourceChange(false);
};
