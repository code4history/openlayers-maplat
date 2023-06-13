import Map from '../src/ol/Map.js';
import View from '../src/ol/View.js';
import WebGLTileLayer from '../src/ol/layer/WebGLTile.js';
import { transform } from '../src/ol/proj.js';
import { defaults } from '../src/ol/interaction/defaults.js';
import { DragRotate } from '../src/ol/interaction.js';
import { altKeyOnly } from '../src/ol/events/condition.js';
import MaplatSource from '../src/ol/maplat/Source.js';
import VectorSource from '../src/ol/source/Vector.js';
import FormatGeoJSON from '../src/ol/format/GeoJSON.js';
import { Style, Icon } from '../src/ol/style.js';
import vectorFilter from '../src/ol/maplat/vectorFilter.js';
import clusterRegister from '../src/ol/maplat/clusterRegister.js';

const centerLngLat = [139.536710, 36.246680];

const createSourceFunc = async (url) => {
  const settingsReq = await fetch(url);
  const settings = await settingsReq.json();

  const mapDivide = url.split(/[\/\.]/);
  const mapID = mapDivide[mapDivide.length - 2];
  const maplatSource = new MaplatSource({
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
  const source = isOjozu ? ojozuSource : akimotoSource;

  const filteredVector = vectorFilter(vectorSource, {
    projectTo: source.getProjection(),
    extent: source.getProjection().getExtent()
  });
  const clusterLayer = new clusterRegister({
  });
  const view = new View({
    center: transform(centerLngLat,"EPSG:4326", source.getProjection()),
    projection: source.getProjection(),
    constrainRotation: false,
    zoom: 2,
    maxZoom: 6
  });

  if (!map) {
    map = new Map({
      target : 'map',
      layers: [
        new WebGLTileLayer({
          title: "館林御城図",
          source: source
        }),
        clusterLayer
      ],
      view: view,
      interactions: defaults({altShiftDragRotate: false}).extend([
        new DragRotate({condition: altKeyOnly})
      ])
    });
  } else {
    map.getLayers().item(1).removeMap();
    map.setLayers([
      new WebGLTileLayer({
        title: "館林御城図",
        source: source
      }),
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
