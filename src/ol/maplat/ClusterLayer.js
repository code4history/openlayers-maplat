/**
 * @module ol/maplat/ClusterLayer
 */
import monotoneChainConvexHull from "monotone-chain-convex-hull";
import Feature from "../Feature.js";
import { Polygon, Point, LineString } from "../geom.js";
import LayerGroup from "../layer/Group.js";
import { Circle, Stroke, Fill, Style, Text, Icon } from "../style.js";
import { Cluster } from "../source.js";
import { Vector as VectorLayer } from "../layer.js";
import { createEmpty, extend, getHeight, getWidth } from "../extent.js";
//import BaseVectorLayer from '../layer/BaseVector.js';
//import CanvasVectorLayerRenderer from '../renderer/canvas/VectorLayer.js';

/**
 * @classdesc
 * Vector data is rendered client-side, as vectors. This layer type provides most accurate rendering
 * even during animations. Points and labels stay upright on rotated views. For very large
 * amounts of vector data, performance may suffer during pan and zoom animations. In this case,
 * try {@link module:ol/layer/VectorImage~VectorImageLayer}.
 *
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Vector.js").default} VectorSourceType
 * @extends {LayerGroup}
 * @api
 */
class ClusterLayer extends LayerGroup {
  /**
   * @callback IconGenerator
   * @param {Feature} member
   * @returns {Icon}
   */

  /**
   * @typedef  { import("../layer/BaseVector.js").Options<VectorSourceType> } Options
   * @property {Stroke} [convexHullStroke] Stroke style definition of convexHull.
   * @property {Fill} [convexHullFill] Fill style definition of convexHull.
   * @property {number} [circleDistanceMultiplier] Distance multiplier for spiderifier on max zoom.
   * @property {number} [circleFootSeparation] Circle foot separation for spiderifier on max zoom.
   * @property {number} [circleStartAngle] Circle start angle for spiderifier on max zoom.
   * @property {number} [clusterDistance] Distance between each members separated for different cluster.
   * @property {IconGenerator} eachIconGenerator Icon generator function for each original features. 
   */

  /**
   * @type {import("../Feature.js").FeatureLike}
   * @private
   */
  clickFeature_;

  /**
   * @type {number}
   * @private
   */
  clickResolution_;

  /**
   * @type {number}
   * @private
   */
  circleDistanceMultiplier_ = 1;

  /**
   * @type {number}
   * @private
   */
  circleFootSeparation_ = 28;

  /**
   * @type {number}
   * @private
   */
  circleStartAngle_ = Math.PI / 2;

  /**
   * @type {import("../Feature.js").FeatureLike}
   * @private
   */
  hoverFeature_;

  /**
   * @param options Options.
   */
  constructor(options) {
    super(options);

    /**
     * @type {Stroke}
     * @private
     */
    this.convexHullStroke_ = options.convexHullStroke || new Stroke({
      color: 'rgba(204, 85, 0, 1)',
      width: 1.5,
    });

    /**
     * @type {Fill}
     * @private
     */
    this.convexHullFill_ = options.convexHullFill || new Fill({
      color: 'rgba(255, 153, 0, 0.4)',
    });

    const outerCircleFill = new Fill({
      color: 'rgba(255, 153, 102, 0.3)',
    });
    /**
     * @type {Circle}
     * @private
     */
    this.outerCircle_ = options.outerCircle || new Circle({
      radius: 20,
      fill: outerCircleFill,
    });

    const innerCircleFill = new Fill({
      color: 'rgba(255, 165, 0, 0.7)',
    });
    /**
     * @type {Circle}
     * @private
     */
    this.innerCircle_ = options.innerCircle || new Circle({
      radius: 14,
      fill: innerCircleFill,
    });;

    /**
     * @type {Fill}
     * @private
     */
    this.textFill_ = options.textFill || new Fill({
      color: '#fff',
    });

    /**
     * @type {Stroke}
     * @private
     */
    this.textStroke_ = options.textStroke || new Stroke({
      color: 'rgba(0, 0, 0, 0.6)',
      width: 3,
    });

    /**
     * @type {number}
     * @private
     */
    this.clusterDistance_ = options.clusterDistance || 35;

    /**
     * @type {IconGenerator}
     * @private
     */
    this.eachIconGenerator_ = options.eachIconGenerator;

    if (options.circleDistanceMultiplier) this.circleDistanceMultiplier_ = options.circleDistanceMultiplier;
    if (options.circleFootSeparation) this.circleFootSeparation_ = options.circleFootSeparation;
    if (options.circleStartAngle) this.circleStartAngle_ = options.circleStartAngle;

    /**
     * @type {VectorSourceType}
     * @private
     */
    this.source_ = options.source;

    /**
     * @type {Cluster}
     * @private
     */
    this.clusterSource_ = new Cluster({
      distance: this.clusterDistance_,
      source: options.source
    });

    /**
     * @type {VectorLayer}
     * @private
     */
    this.clusterHulls_ = new VectorLayer({
      source: this.clusterSource_,
      style: (f) => { this.clusterHullStyle_(f) },
    });

    /**
     * @type {VectorLayer}
     * @private
     */
    this.clusters_ = new VectorLayer({
      source: this.clusterSource_,
      style: (f) => { this.clusterStyle_(f) },
    });

    /**
     * @type {VectorLayer}
     * @private
     */
    this.clusterCircles_ = new VectorLayer({
      source: this.clusterSource_,
      style: (f, r) => { this.clusterCircleStyle_(f, r) },
    });

    //const layers = this.getLayers();
    //layers.insertAt(0, this.clusterHulls_);
    //layers.insertAt(1, this.clusters_);
    //layers.insertAt(2, this.clusterCircles_);
  }

  /**
   * Set map instance for set up event handler
   * @param {import("../Map.js").default} map Map instance
   * @return {void}
   * @api
   */
  registerMap(map) {
    this.clusterHulls_.setMap(map);
    this.clusters_.setMap(map);
    this.clusterCircles_.setMap(map);
    map.on('pointermove', (event) => {
      this.clusters_.getFeatures(event.pixel).then((features) => {
        if (features[0] !== this.hoverFeature_) {
          // Display the convex hull on hover.
          this.hoverFeature_ = features[0];
          this.clusterHulls_.setStyle(this.clusterHullStyle_);
          // Change the cursor style to indicate that the cluster is clickable.
          map.getTargetElement().style.cursor =
            this.hoverFeature_ ? 'pointer' : '';
        }
      });
    });
    map.on('click', (event) => {
      this.clusters_.getFeatures(event.pixel).then((features) => {
        if (features.length > 0) {
          const clusterMembers = features[0].get('features');
          if (clusterMembers.length > 1) {
            // Calculate the extent of the cluster members.
            const extent = createEmpty();
            clusterMembers.forEach((feature) =>
              extend(extent, feature.getGeometry().getExtent())
            );
            const view = map.getView();
            const resolution = map.getView().getResolution();
            if (
              view.getZoom() === view.getMaxZoom() ||
              (getWidth(extent) < resolution && getHeight(extent) < resolution)
            ) {
              // Show an expanded view of the cluster members.
              this.clickFeature_ = features[0];
              this.clickResolution_ = resolution;
              this.clusterCircles_.setStyle(this.clusterCircleStyle_);
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
  }

  /**
   * Style for clusters with features that are too close to each other, activated on click.
   * @param {import("../Feature.js").FeatureLike} cluster A cluster with overlapping members.
   * @param {number} resolution The current view resolution.
   * @return {Style|null} A style to render an expanded view of the cluster members.
   * @private
   */
  clusterCircleStyle_(cluster, resolution) {
    if (cluster !== this.clickFeature_ || resolution !== this.clickResolution_) {
      return null;
    }
    const clusterMembers = cluster.get('features');
    // @ts-ignore
    const centerCoordinates = cluster.getGeometry().getCoordinates();
    // @ts-ignore
    return this.generatePointsCircle_(
      clusterMembers.length,
      centerCoordinates,
      resolution
    ).reduce(
    /**
     * @param {Array<Style>} styles Array of Styles from previous loop.
     * @param {Array[number]} coordinates Coordinates.
     * @param {number} i Array index.
     * @return {Array<Style>} Array of Styles.
     */
    (styles, coordinates, i) => {
      const point = new Point(coordinates);
      const line = new LineString([centerCoordinates, coordinates]);
      styles.unshift(
        new Style({
          geometry: line,
          stroke: this.convexHullStroke_,
        })
      );
      styles.push(
        this.clusterMemberStyle_(
          new Feature({
            ...clusterMembers[i].getProperties(),
            geometry: point,
          })
        )
      );
      return styles;
    }, 
    []);
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
   * @private
   */
  generatePointsCircle_(count, clusterCenter, resolution) {
    const circumference =
      this.circleDistanceMultiplier_ * this.circleFootSeparation_ * (2 + count);
    let legLength = circumference / (Math.PI * 2); //radius from circumference
    const angleStep = (Math.PI * 2) / count;
    const res = [];
    let angle;
  
    legLength = Math.max(legLength, 35) * resolution; // Minimum distance to get outside the cluster icon.
  
    for (let i = 0; i < count; ++i) {
      // Clockwise, like spiral.
      angle = this.circleStartAngle_ + i * angleStep;
      res.push([
        clusterCenter[0] + legLength * Math.cos(angle),
        clusterCenter[1] + legLength * Math.sin(angle),
      ]);
    }
  
    return res;
  }

  /**
   * Style for convex hulls of clusters, activated on hover.
   * @param {import("../Feature.js").FeatureLike} cluster The cluster feature.
   * @return {Style|null} Polygon style for the convex hull of the cluster.
   * @private
   */
  clusterHullStyle_(cluster) {
    if (cluster !== this.hoverFeature_) {
      return null;
    }
    const originalFeatures = cluster.get('features');
    const points = originalFeatures.map((feature) =>
      feature.getGeometry().getCoordinates()
    );
    return new Style({
      geometry: new Polygon([monotoneChainConvexHull(points)]),
      fill: this.convexHullFill_,
      stroke: this.convexHullStroke_,
    });
  }

  /**
   * Style for cluster circle and original feature.
   * @param {import("../Feature.js").FeatureLike} feature The cluster or original feature.
   * @return {Array<Style>|Style} Style for cluster circle and original feature.
   * @private
   */
  clusterStyle_(feature) {
    const size = feature.get('features').length;
    if (size > 1) {
      return [
        new Style({
          image: this.outerCircle_,
        }),
        new Style({
          image: this.innerCircle_,
          text: new Text({
            text: size.toString(),
            fill: this.textFill_,
            stroke: this.textStroke_,
          }),
        }),
      ];
    }
    const originalFeature = feature.get('features')[0];
    return this.clusterMemberStyle_(originalFeature);
  }

  /**
   * Style for original feature.
   * @param {Feature} clusterMember The  original feature.
   * @return {Style} Style for original feature.
   * @private
   */
  clusterMemberStyle_(clusterMember) {
    return new Style({
      geometry: clusterMember.getGeometry(),
      image: this.eachIconGenerator_(clusterMember),
    });
  }
}

export default ClusterLayer;