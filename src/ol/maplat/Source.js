/**
 * @module ol/maplat/Source
 */
import Zoomify from "../source/Zoomify.js";
import Tin from "@maplat/tin";
import { Projection, addCoordinateTransforms, transform } from "../proj.js";

/**
 * @typedef {Object} Options
 * @property {import("../source/Source.js").AttributionLike} [attributions] Attributions.
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
 * @property {import("../size.js").Size} size Size.
 * @property {number} [transition] Duration of the opacity transition for rendering.
 * To disable the opacity transition, pass `transition: 0`.
 * @property {number} [tileSize=256] Tile size. Same tile size is used for all zoom levels.
 * @property {number|import("../array.js").NearestDirectionFunction} [zDirection=0]
 * Choose whether to use tiles with a higher or lower zoom level when between integer
 * zoom levels. See {@link module:ol/tilegrid/TileGrid~TileGrid#getZForResolution}.
 * @property {import("@maplat/tin").Compiled} [tinCompiled] Compiled data of Maplat TIN (Triangle Irregular Network) setting.
 * @property {string} [mapID] Map ID of Maplat data.
 */

/**
 * @classdesc
 * Layer source for tile data in Maplat format.
 * @api
 */
class Source extends Zoomify {
  /**
   * @param {Options} options Options.
   */
  constructor(options) {
    //Set up Maplat TIN 
    const size = options.size;
    const maxZoom = Math.ceil(Math.max(Math.log2(size[0]/256), Math.log2(size[1]/256)));
    const extent = [0, -size[1], size[0], 0];
    const worldExtentSize = 256 * Math.pow(2, maxZoom);
    const worldExtent = [0, -worldExtentSize, worldExtentSize, 0];
    const url = options.url;
    const tin = new Tin();
    tin.setCompiled(options.tinCompiled);
    const mapID = options.mapID;

    //Set up Maplat projection
    const maplatProject = new Projection({
      code: `Maplat:${mapID}`,
      units: "pixels",
      extent: extent,
      worldExtent: worldExtent
    });
    addCoordinateTransforms(
      maplatProject,
      "EPSG:3857",
      // @ts-ignore
      xy => tin.transform([xy[0],-xy[1]], false),
      merc => {
        const xy = tin.transform(merc, true);
        return [xy[0], -xy[1]];
      }
    );
    addCoordinateTransforms(
      maplatProject,
      "EPSG:4326",
      xy => transform(transform(xy, maplatProject, "EPSG:3857"), "EPSG:3857", "EPSG:4326"),
      lnglat => transform(transform(lnglat, "EPSG:4326", "EPSG:3857"), "EPSG:3857", maplatProject)
    );

    super({
      attributions: options.attributions,
      cacheSize: options.cacheSize,
      crossOrigin: options.crossOrigin,
      interpolate: options.interpolate,
      projection: maplatProject,
      extent: extent,
      size: size,
      url: "",
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      transition: options.transition,
    });
    this.setTileUrlFunction(tileCoord =>
      url
        .replace('{z}', `${tileCoord[0]}`)
        .replace('{x}', `${tileCoord[1]}`)
        .replace('{y}', `${tileCoord[2]}`)
    );
  }
}

export default Source;

/*

const animatedgif = "https://openlayers.org/en/latest/examples/data/globe.gif";

const geojson = {
  "type": "FeatureCollection",
  "name": "nara_line",
  "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
  "features": [
    { "type": "Feature", "properties": { }, "geometry": { "type": "LineString", "coordinates": [ [ 135.826021931272862, 34.689327113501022 ], [ 135.826073735952264, 34.686696743932153 ], [ 135.829693587925277, 34.686845835939643 ], [ 135.829693587925277, 34.689332438051004 ] ] } }
  ]
};

const thetas = [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75].map((pow) => {
  return pow * Math.PI;
});

const center2Vicinities = (center, radius) => {
  const vicinities = thetas.map((theta) => {
    return [center[0] + Math.sin(theta) * radius, center[1] + Math.cos(theta) * radius];
  });
  vicinities.unshift(center);
  return vicinities;
};

const normalizeAngle = (theta) => {
  while (theta > Math.PI || theta <= -Math.PI) {
    theta = theta > Math.PI ? theta - 2 * Math.PI : theta + 2 * Math.PI;
  }
  return theta;
};

const params2Params = (fromCenter, fromRotation, fromResolution, baseRadius, fromProj, toProj, baseProj = "EPSG:3857") => {
  let midCenter = fromCenter, midRotation = fromRotation, midResolution = fromResolution;
  if (fromProj != baseProj) {
    [midCenter, midRotation, midResolution] = maplat2Base(fromCenter, fromRotation, fromResolution, baseRadius, fromProj, baseProj);
  }
  if (toProj != baseProj) return base2Maplat(midCenter, midRotation, midResolution, baseRadius, toProj, baseProj);
  else return [midCenter, midRotation, midResolution];
};

const maplat2Base = (maplatCenter, maplatRotation, maplatResolution, baseRadius, maplatProj, baseProj = "EPSG:3857") => {
  const baseCenter = ol.proj.transform(maplatCenter, maplatProj, baseProj);
  const maplatParams = base2MaplatParams(baseCenter, baseRadius, maplatProj, baseProj);
  const baseResolution = maplatResolution * baseRadius / maplatParams[2];
  const baseRotation = normalizeAngle(maplatRotation + maplatParams[1]);
  return [baseCenter, baseRotation, baseResolution];
};

const base2Maplat = (baseCenter, baseRotation, baseResolution, baseRadius, maplatProj, baseProj = "EPSG:3857") => {
  const maplatParams = base2MaplatParams(baseCenter, baseRadius, maplatProj, baseProj);
  const maplatCenter = maplatParams[0];
  const maplatResolution = baseResolution * maplatParams[2] / baseRadius;
  const maplatRotation = normalizeAngle(baseRotation - maplatParams[1]);
  return [maplatCenter, maplatRotation, maplatResolution];
};

const base2MaplatParams = (center, radius, maplatProj, baseProj) => {
  const maplatVicinities = center2Vicinities(center, radius).map((baseCoord) => {
    return ol.proj.transform(baseCoord, baseProj, maplatProj);
  });
  const maplatCenter = maplatVicinities.shift();
  const maplatParams = maplatVicinities.map((maplatCoord, index) => {
    const vacinity = [maplatCoord[0] - maplatCenter[0], maplatCoord[1] - maplatCenter[1]];
    const theta = Math.atan2(vacinity[0], vacinity[1]);
    const distance = Math.sqrt(Math.pow(vacinity[0], 2) + Math.pow(vacinity[1], 2));
    return [normalizeAngle(theta - thetas[index]), distance];
  }).reduce((prev, curr, index) => {
    const thetax = Math.cos(curr[0]);
    const thetay = Math.sin(curr[0]);
    const dist = curr[1];
    if (!prev) return [thetax, thetay, dist];
    prev[0] = prev[0] + thetax;
    prev[1] = prev[1] + thetay;
    prev[2] = prev[2] + dist;
    if (index == 7) return [maplatCenter, Math.atan2(prev[1], prev[0]), prev[2] / 8];
    return prev;
  }, null);
  return maplatParams;
};

const createGlobeVector = (map, project) => {
  const feature = new ol.Feature({
    geometry: new ol.geom.Point(ol.proj.transform(centerLngLat,"EPSG:4326", project))
  });
  const gif = gifler(animatedgif);
  gif.frames(
    document.createElement('canvas'),
    function (ctx, frame) {
      if (!feature.getStyle()) {
        feature.setStyle(
          new ol.style.Style({
            image: new ol.style.Icon({
              img: ctx.canvas,
              imgSize: [frame.width, frame.height],
              scale: 0.4,
              opacity: 0.8,
              anchor: [0.5, 1.0]
            }),
          })
        );
      }
      ctx.clearRect(0, 0, frame.width, frame.height);
      ctx.drawImage(frame.buffer, frame.x, frame.y);
      map.render();
    },
    true
  );
  return new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [feature]
    })
  });
};

const style = new ol.style.Style({
  stroke: new ol.style.Stroke({
    color: 'green',
    width: 3,
  })
});
const centerLngLat = [139.536710, 36.246680];

const maplat1 = "tatebayashi_ojozu";
const maplat2 = "tatebayashi_castle_akimoto";

const createMaplatSource = async (mapID) => {
  const req = await fetch(`https://s.maplat.jp/r/tatebayashimap/maps/${mapID}.json`);
  const settings = await req.json();
  const size = [settings.width, settings.height];
  const maxZoom = Math.ceil(Math.max(Math.log2(size[0]/256), Math.log2(size[1]/256)));
  const coordinateExtent = 256 * Math.pow(2, maxZoom);
  const url = settings.url;
  const tin = new Tin();
  tin.setCompiled(settings.compiled);
  
  const maplatProject = new ol.proj.Projection({
    code: `Maplat:${mapID}`,
    units: "pixel",
    extent: [0, -size[1], size[0], 0 ],
    worldExtent: [0, -coordinateExtent, coordinateExtent, 0 ]
  });
  ol.proj.addCoordinateTransforms(
    maplatProject,
    "EPSG:3857",
    xy => tin.transform([xy[0],-xy[1]], false),
    merc => {
      const xy = tin.transform(merc, true);
      return [xy[0], -xy[1]];
    }
  );
  ol.proj.addCoordinateTransforms(
    maplatProject,
    "EPSG:4326",
    xy => ol.proj.transform(ol.proj.transform(xy, maplatProject, "EPSG:3857"), "EPSG:3857", "EPSG:4326"),
    lnglat => ol.proj.transform(ol.proj.transform(lnglat, "EPSG:4326", "EPSG:3857"), "EPSG:3857", maplatProject)
  );

  const maplatSource = new ol.source.Zoomify({
    projection: maplatProject,
    extent: [0, -size[1], size[0], 0],
    size,
    url: ""
  });
  maplatSource.setTileUrlFunction(tileCoord =>
    url
      .replace('{z}', tileCoord[0])
      .replace('{x}', tileCoord[1])
      .replace('{y}', tileCoord[2])
  );
  
  return [maplatProject, maplatSource];
};

const filterGeoJSON = (source, options) => {
  const extent = options.extent;
  const projectTo = options.projectTo;
  const retSource = new ol.source.Vector();
  source.forEachFeature((f) => {
    let retF = f.clone();
    if (projectTo) {
      retF.setGeometry(retF.getGeometry().transform("EPSG:4326", projectTo));
    }
    if (!extent || retF.getGeometry().intersectsExtent(extent)) {
      retSource.addFeature(retF);
    }
  });
  return retSource;
};

const convexHullFill = new ol.style.Fill({
  color: 'rgba(255, 153, 0, 0.4)',
});
const convexHullStroke = new ol.style.Stroke({
  color: 'rgba(204, 85, 0, 1)',
  width: 1.5,
});
const outerCircleFill = new ol.style.Fill({
  color: 'rgba(255, 153, 102, 0.3)',
});
const innerCircleFill = new ol.style.Fill({
  color: 'rgba(255, 165, 0, 0.7)',
});
const textFill = new ol.style.Fill({
  color: '#fff',
});
const textStroke = new ol.style.Stroke({
  color: 'rgba(0, 0, 0, 0.6)',
  width: 3,
});
const innerCircle = new ol.style.Circle({
  radius: 14,
  fill: innerCircleFill,
});
const outerCircle = new ol.style.Circle({
  radius: 20,
  fill: outerCircleFill,
});

const iconGenerator = (data) => {
  const type = data.get("type");
  const title = data.get("title");
  const shape = data.get("shape");
  const status = data.get("status");
  const need_action = data.get("need_action");
  const confirmed = data.get("confirmed");
  const contradiction = data.get("contradiction");

  let prefix = "stone";
  if (type.match(/地蔵/)) {
    prefix = "jizo";
  } else if (type.match(/菩薩/) || type.match(/その他石仏/) || type.match(/石仏群/)) {
    prefix = "bosatsu";
  } else if (type.match(/如来/)) {
    prefix = "nyorai";
  } else if (type.match(/明王/)) {
    prefix = "myooh";
  } else if (type.match(/天部/)) {
    if (title.match(/([弁辨][財才]?|吉祥)天/)) {
      prefix = "ten_female";
    } else {
      prefix = "ten_male";
    }
  } else if (type.match(/小神社/)) {
    prefix = "shrine";
  } else if (type.match(/小祠/)) {
    prefix = "hokora";
  } else if (type.match(/石祠/)) {
    prefix = "sekishi";
  } else if (type.match(/石(神|塚)/)) {
    prefix = "sekijin";
  } else if (type.match(/(野神|神木)/)) {
    prefix = "tree";
  } else if (type.match(/庚申/)) {
    if (title.match(/青面/) || shape.match(/青面/)) {
      prefix = "shomen";
    } else {
      prefix = "koshin";
    }
  } else if (type.match(/青面金剛/)) {
    prefix = "shomen";
  } else if (type.match(/馬頭観音/)) {
    prefix = "bato";
  } else if (type.match(/月待塔/)) {
    prefix = "tsukimachi";
  } else if (type.match(/如意輪観音/)) {
    prefix = "nyoirin";
  } else if (type.match(/道標/)) {
    prefix = "dohyo";
  } else if (type.match(/標石/)) {
    prefix = "stone_display";
  } else if (type.match(/道祖神/)) {
    prefix = "dosojin";
  } else if (type.match(/(顕彰|戦争)碑/)) {
    prefix = "chukonhi";
  } else if (type.match(/(句歌|供養|記念)碑/)) {
    prefix = "kinenhi";
  } else if (type.match(/供養塔/)) {
    prefix = "kuyohi";
  } else if (type.match(/(名号|題目)/)) {
    prefix = "myogo";
  } else if (type.match(/浮彫五輪塔/)) {
    prefix = "ukibori_gorin";
  } else if (type.match(/富士講/)) {
    prefix = "fujiko";
  } else if (type.match(/(湯殿山|大峰講|山岳信仰)/)) {
    prefix = "mount";
  } else if (type.match(/宝篋印塔/)) {
    prefix = "hokyoin";
  } else if (type.match(/五輪塔/)) {
    prefix = "gorinto";
  } else if (type.match(/板碑/)) {
    prefix = "itahi";
  } else if (type.match(/墓碑/)) {
    prefix = "tomb";
  } else if (type.match(/板碑/)) {
    prefix = "itahi";
  } else if (type.match(/(甲子|巳待|日待)塔/)) {
    prefix = "himachi";
  } else if (type.match(/石塔/)) {
    prefix = "stone_tower";
  } else if (type.match(/碑/)) {
    prefix = "kinenhi";
  }
  if (status && status.match(/消失/)) {
    prefix = `${prefix}_missing`;
  } else if (need_action || !confirmed || contradiction){
    prefix = `${prefix}_action`;
  }

  return new ol.style.Icon({
    src: `https://raw.githubusercontent.com/code4history/Chokei/main/png/${prefix}.png`,
    anchor: [0.5, 1.0]
  });
};

const main = async () => {
  const [maplat1Project, maplat1Source] = await createMaplatSource(maplat1);
  const [maplat2Project, maplat2Source] = await createMaplatSource(maplat2);
  ol.proj.addCoordinateTransforms(
    maplat1Project,
    maplat2Project,
    xy => ol.proj.transform(ol.proj.transform(xy, maplat1Project, "EPSG:3857"), "EPSG:3857", maplat2Project),
    lnglat => ol.proj.transform(ol.proj.transform(lnglat, maplat2Project, "EPSG:3857"), "EPSG:3857", maplat1Project)
  );
  
  const stoneReq = await fetch('https://raw.githubusercontent.com/code4history/TatebayashiStones/master/tatebayashi_stones.geojson');
  const stoneSettings = await stoneReq.json();
  console.log(stoneSettings);
  
  const gjStyle = {
    symbol: {
      symbolType: 'circle',
      size: [
        'interpolate',
        ['linear'],
        ['get', 'population'],
        40000,
        8,
        2000000,
        28,
      ],
      color: ['match', ['get', 'hover'], 1, '#ff3f3f', '#006688'],
      rotateWithView: false,
      offset: [0, 0],
      opacity: [
        'interpolate',
        ['linear'],
        ['get', 'population'],
        40000,
        0.6,
        2000000,
        0.92,
      ],
    },
  };
  
  const osmSource = new ol.source.OSM();
  
  function clusterMemberStyle(clusterMember) {
    return new ol.style.Style({
      geometry: clusterMember.getGeometry(),
      image: iconGenerator(clusterMember),
    });
  }

  let clickFeature, clickResolution;
  /**
   * Style for clusters with features that are too close to each other, activated on click.
   * @param {Feature} cluster A cluster with overlapping members.
   * @param {number} resolution The current view resolution.
   * @return {Style|null} A style to render an expanded view of the cluster members.
   * /
  function clusterCircleStyle(cluster, resolution) {
    if (cluster !== clickFeature || resolution !== clickResolution) {
      return null;
    }
    const clusterMembers = cluster.get('features');
    const centerCoordinates = cluster.getGeometry().getCoordinates();
    return generatePointsCircle(
      clusterMembers.length,
      cluster.getGeometry().getCoordinates(),
      resolution
    ).reduce((styles, coordinates, i) => {
      const point = new ol.geom.Point(coordinates);
      const line = new ol.geom.LineString([centerCoordinates, coordinates]);
      styles.unshift(
        new ol.style.Style({
          geometry: line,
          stroke: convexHullStroke,
        })
      );
      styles.push(
        clusterMemberStyle(
          new ol.Feature({
            ...clusterMembers[i].getProperties(),
            geometry: point,
          })
        )
      );
      return styles;
    }, []);
  }

  /**
   * From
   * https://github.com/Leaflet/Leaflet.markercluster/blob/31360f2/src/MarkerCluster.Spiderfier.js#L55-L72
   * Arranges points in a circle around the cluster center, with a line pointing from the center to
   * each point.
   * @param {number} count Number of cluster members.
   * @param {Array<number>} clusterCenter Center coordinate of the cluster.
   * @param {number} resolution Current view resolution.
   * @return {Array<Array<number>>} An array of coordinates representing the cluster members.
   * /
  function generatePointsCircle(count, clusterCenter, resolution) {
    const circumference =
      circleDistanceMultiplier * circleFootSeparation * (2 + count);
    let legLength = circumference / (Math.PI * 2); //radius from circumference
    const angleStep = (Math.PI * 2) / count;
    const res = [];
    let angle;

    legLength = Math.max(legLength, 35) * resolution; // Minimum distance to get outside the cluster icon.

    for (let i = 0; i < count; ++i) {
      // Clockwise, like spiral.
      angle = circleStartAngle + i * angleStep;
      res.push([
        clusterCenter[0] + legLength * Math.cos(angle),
        clusterCenter[1] + legLength * Math.sin(angle),
      ]);
    }

    return res;
  }

  let hoverFeature1, hoverFeature2;
  /**
   * Style for convex hulls of clusters, activated on hover.
   * @param {Feature} cluster The cluster feature.
   * @return {Style|null} Polygon style for the convex hull of the cluster.
   * /
  function clusterHullStyle(cluster) {
    if (cluster !== hoverFeature1 && cluster !== hoverFeature2) {
      return null;
    }
    const originalFeatures = cluster.get('features');
    const points = originalFeatures.map((feature) =>
      feature.getGeometry().getCoordinates()
    );
    return new ol.style.Style({
      geometry: new ol.geom.Polygon([monotoneChainConvexHull(points)]),
      fill: convexHullFill,
      stroke: convexHullStroke,
    });
  }

  function clusterStyle(feature) {
    const size = feature.get('features').length;
    if (size > 1) {
      return [
        new ol.style.Style({
          image: outerCircle,
        }),
        new ol.style.Style({
          image: innerCircle,
          text: new ol.style.Text({
            text: size.toString(),
            fill: textFill,
            stroke: textStroke,
          }),
        }),
      ];
    }
    const originalFeature = feature.get('features')[0];
    return clusterMemberStyle(originalFeature);
  }

  const stoneSource = new ol.source.Vector({
    features: new ol.format.GeoJSON().readFeatures(stoneSettings, {
      featureProjection: "EPSG:4326",
      dataProjection: "EPSG:4326",
    })
  });
  const stoneSource1 = filterGeoJSON(stoneSource, {
    projectTo: maplat1Project,
    extent: maplat1Project.getExtent()
  });
  const stoneSource2 = filterGeoJSON(stoneSource, {
    projectTo: maplat2Project,
    extent: maplat2Project.getExtent()
  });
  
  const clusterSource1 = new ol.source.Cluster({
    attributions:
      'Data: <a href="https://www.data.gv.at/auftritte/?organisation=stadt-wien">Stadt Wien</a>',
    distance: 35,
    source: stoneSource1,
  });
  const clusterHulls1 = new ol.layer.Vector({
    source: clusterSource1,
    style: clusterHullStyle,
  });
  const clusters1 = new ol.layer.Vector({
    source: clusterSource1,
    style: clusterStyle,
  });
  const clusterCircles1 = new ol.layer.Vector({
    source: clusterSource1,
    style: clusterCircleStyle,
  });
  const clusterSource2 = new ol.source.Cluster({
    attributions:
      'Data: <a href="https://www.data.gv.at/auftritte/?organisation=stadt-wien">Stadt Wien</a>',
    distance: 35,
    source: stoneSource2,
  });
  const clusterHulls2 = new ol.layer.Vector({
    source: clusterSource2,
    style: clusterHullStyle,
  });
  const clusters2 = new ol.layer.Vector({
    source: clusterSource2,
    style: clusterStyle,
  });
  const clusterCircles2 = new ol.layer.Vector({
    source: clusterSource2,
    style: clusterCircleStyle,
  });
  
  const map1 = new ol.Map({
    target : 'map1',
    layers: [
      new ol.layer.WebGLTile({
        title: "OpenStreetMap",
        source: new ol.source.OSM()
      }),
      new ol.layer.WebGLTile({
        title: "保井文庫奈良町絵図",
        source: maplat1Source
      }),
      new ol.layer.Vector({
        source: new ol.source.Vector({
          features: new ol.format.GeoJSON().readFeatures(geojson, {
            featureProjection: maplat1Project,
            dataProjection: "EPSG:4326"
          })
        }),
        style: style,
      }),
      clusterHulls1, 
      clusters1, 
      clusterCircles1
    ],
    view: new ol.View({
      center: ol.proj.transform(centerLngLat,"EPSG:4326", maplat1Project),
      projection: maplat1Project,
      constrainRotation: false,
      zoom: 2
    }),
    interactions: ol.interaction.defaults.defaults({altShiftDragRotate: false}).extend([
      new ol.interaction.DragRotate({condition: ol.events.condition.altKeyOnly})
    ])
  });
  const layerSwitcher1 = new LayerSwitcher({
    reverse: true,
    groupSelectStyle: 'group'
  });
  map1.addControl(layerSwitcher1);
  map1.addLayer(
      createGlobeVector(map1, maplat1Project));
  
  const map2 = new ol.Map({
    target : 'map2',
    layers: [
      new ol.layer.WebGLTile({
        title: "OpenStreetMap",
        source: new ol.source.OSM()
      }),
      new ol.layer.WebGLTile({
        title: "絵図屋奈良町絵図",
        source: maplat2Source
      }),
      new ol.layer.Vector({
        source: new ol.source.Vector({
          features: new ol.format.GeoJSON().readFeatures(geojson, {
            featureProjection: maplat2Project,
            dataProjection: "EPSG:4326"
          })
        }),
        style: style,
      }),
      clusterHulls2, 
      clusters2, 
      clusterCircles2
    ],
    view: new ol.View({
      center: ol.proj.transform(centerLngLat,"EPSG:4326", maplat2Project),
      projection: maplat2Project,
      constrainRotation: false,
      zoom: 2
    }),
    interactions: ol.interaction.defaults.defaults({altShiftDragRotate: false}).extend([
      new ol.interaction.DragRotate({condition: ol.events.condition.altKeyOnly})
    ])
  });
  const layerSwitcher2= new LayerSwitcher({
    reverse: true,
    groupSelectStyle: 'group'
  });
  map2.addControl(layerSwitcher2);
  map2.addLayer(
      createGlobeVector(map2, maplat2Project));
  
  const mapClicker = (e) => {
    const projection = e.map.getView().getProjection();
    const merc = ol.proj.transform(e.coordinate, projection, "EPSG:3857");
    const lnglat = ol.proj.transform(e.coordinate, projection, "EPSG:4326");
    alert(`XY: ${e.coordinate}\nMercator: ${merc}\nLngLat: ${lnglat}`);
  };
  //map1.on('click', mapClicker);
  //map2.on('click', mapClicker);
  
  const replicaMapMove = (e) => {
    const map = e.map;
    const view = map.getView();
    const otherMap = map === map1 ? map2 : map1;
    const fromProj = map === map1 ? maplat1Project : maplat2Project;
    const toProj = map === map1 ? maplat2Project : maplat1Project;
    if (map.get("moving")) {
      map.set("moving", false);
      return;
    }
    otherMap.set("moving", true);
    const center = view.getCenter();
    const rotation = view.getRotation();
    const resolution = view.getResolution();
    if ((map.get("preCenter") || [])[0] == center[0] && (map.get("preCenter") || [])[1] == center[1] && map.get("preRotation") == rotation && map.get("preResolution") == resolution) return;
    map.set("preCenter", center);
    map.set("preRotation", rotation);
    map.set("preResolution", resolution);
    const otherParams = params2Params(center, rotation, resolution, 500, fromProj, toProj);
    const otherView = otherMap.getView();
    otherView.setCenter(otherParams[0]);
    otherView.setResolution(otherParams[2]);
    otherView.setRotation(otherParams[1]);
  };
  map1.on('postrender', replicaMapMove);
  map2.on('postrender', replicaMapMove);

  map1.on('pointermove', (event) => {
    clusters1.getFeatures(event.pixel).then((features) => {
      if (features[0] !== hoverFeature1) {
        // Display the convex hull on hover.
        hoverFeature1 = features[0];
        clusterHulls1.setStyle(clusterHullStyle);
        // Change the cursor style to indicate that the cluster is clickable.
        map1.getTargetElement().style.cursor =
          hoverFeature1 ? 'pointer' : '';
      }
    });
  });
  map2.on('pointermove', (event) => {
    clusters2.getFeatures(event.pixel).then((features) => {
      if (features[0] !== hoverFeature2) {
        // Display the convex hull on hover.
        hoverFeature2 = features[0];
        clusterHulls2.setStyle(clusterHullStyle);
        // Change the cursor style to indicate that the cluster is clickable.
        map2.getTargetElement().style.cursor =
          hoverFeature2 ? 'pointer' : '';
      }
    });
  });
  
  map1.on('click', (event) => {
    clusters1.getFeatures(event.pixel).then((features) => {
      if (features.length > 0) {
        const clusterMembers = features[0].get('features');
        if (clusterMembers.length > 1) {
          // Calculate the extent of the cluster members.
          const extent = ol.extent.createEmpty();
          clusterMembers.forEach((feature) =>
            ol.extent.extend(extent, feature.getGeometry().getExtent())
          );
          const view = map1.getView();
          const resolution = map1.getView().getResolution();
          if (
            view.getZoom() === view.getMaxZoom() ||
            (ol.extent.getWidth(extent) < resolution && ol.extent.getHeight(extent) < resolution)
          ) {
            // Show an expanded view of the cluster members.
            clickFeature = features[0];
            clickResolution = resolution;
            clusterCircles1.setStyle(clusterCircleStyle);
          } else {
            // Zoom to the extent of the cluster members.
            view.fit(extent, {duration: 500, padding: [50, 50, 50, 50]});
          }
        } else {
          console.log(clusterMembers[0].getProperties());
        }
      }
    });
  });
  map2.on('click', (event) => {
    clusters2.getFeatures(event.pixel).then((features) => {
      if (features.length > 0) {
        const clusterMembers = features[0].get('features');
        if (clusterMembers.length > 1) {
          // Calculate the extent of the cluster members.
          const extent = ol.extent.createEmpty();
          clusterMembers.forEach((feature) =>
            ol.extent.extend(extent, feature.getGeometry().getExtent())
          );
          const view = map2.getView();
          const resolution = map2.getView().getResolution();
          if (
            view.getZoom() === view.getMaxZoom() ||
            (ol.extent.getWidth(extent) < resolution && ol.extent.getHeight(extent) < resolution)
          ) {
            // Show an expanded view of the cluster members.
            clickFeature = features[0];
            clickResolution = resolution;
            clusterCircles2.setStyle(clusterCircleStyle);
          } else {
            // Zoom to the extent of the cluster members.
            view.fit(extent, {duration: 500, padding: [50, 50, 50, 50]});
          }
        } else {
          console.log(clusterMembers[0].getProperties());
        }
      }
    });
  });

};

main();

*/