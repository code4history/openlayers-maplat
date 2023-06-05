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
import VectorLayer from '../src/ol/layer/Vector.js';
import { Style, Icon } from '../src/ol/style.js';
import vectorFilter from '../src/ol/maplat/vectorFilter.js';

const centerLngLat = [139.536710, 36.246680];

const settingsReq = await fetch("https://s.maplat.jp/r/tatebayashimap/maps/tatebayashi_ojozu.json");
const settings = await settingsReq.json();

const vectorReq = await fetch("https://raw.githubusercontent.com/code4history/TatebayashiStones/master/tatebayashi_stones.geojson");
const vectorJSON = await vectorReq.json();
const vectorSource = new VectorSource({
  features: new FormatGeoJSON().readFeatures(vectorJSON, {
    featureProjection: "EPSG:4326",
    dataProjection: "EPSG:4326"
  })
});

console.log(settings);

const maplatSource = new MaplatSource({
  size: [settings.width, settings.height],
  url: settings.url,
  tinCompiled: settings.compiled,
  mapID: "tatebayashi_ojozu"
});

const filteredSource = vectorFilter(vectorSource, {
  projectTo: maplatSource.getProjection(),
  extent: maplatSource.getProjection().getExtent()
});

const map = new Map({
  target : 'map',
  layers: [
    new WebGLTileLayer({
      title: "館林御城図",
      source: maplatSource
    }),
    new VectorLayer({
      source: filteredSource,
      style: (clusterMember) => {
        return new Style({
          geometry: clusterMember.getGeometry(),
          image: new Icon({
            src: iconSelector(clusterMember),
            anchor: [0.5, 1.0]
          }),
        });
      },
    })
  ],
  view: new View({
    center: transform(centerLngLat,"EPSG:4326", maplatSource.getProjection()),
    projection: maplatSource.getProjection(),
    constrainRotation: false,
    zoom: 2
  }),
  interactions: defaults({altShiftDragRotate: false}).extend([
    new DragRotate({condition: altKeyOnly})
  ])
});

document.getElementById('zoom-out').onclick = function () {
  const view = map.getView();
  const zoom = view.getZoom();
  view.setZoom(zoom - 1);
};

document.getElementById('zoom-in').onclick = function () {
  const view = map.getView();
  const zoom = view.getZoom();
  view.setZoom(zoom + 1);
};
