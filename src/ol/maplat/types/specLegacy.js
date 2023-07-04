/**
 * @module ol/maplat/types/specLegacy
 */

/**
 * @typedef { Object } MaplatCompiledLegacy0
 * @property { Array<[Coordinate2D, Coordinate2D, (string | undefined)]> } points List of GCPs
 * @property { { BiDirectionKey: MaplatLegacyWeightBufferList } } weight_buffer Weight Buffer of each vertices
 * @property { [ Coordinate2D, Coordinate2D ] } centroid_point Centroid point of mapping
 * @property { [ ValuesOfVertices, ValuesOfVertices ] } vertices_params Weight parameters of map vertices
 * @property { Array<[Coordinate2D, Coordinate2D]> } vertices_points Definition of vertices points
 * @property { "strict" | "strict_error" | "loose" } strict_status Strict / loose status of mapping
 * @property { Array<Array<[EdgeIndex, EdgeIndex, EdgeIndex]>> } tins_points Vertices list of triangle polygons
 * @property { "follow" | "invert" } yaxisMode Direction of Y axis
 * @property { "plain" | "birdeye" } vertexMode Vertex location estimation mode
 * @property { "strict" | "auto" | "loose" } strictMode Strict / loose mode of mapping
 * @property { Coordinate2D } wh Size of image (width, height)
 * @property { Array<[Array<Coordinate2D>, Array<Coordinate2D>, [EdgeIndex, EdgeIndex]]> } edges Edges of mapping
 * @property { Array<[Coordinate2D, Coordinate2D]> } edgesNodes Nodes of edges
 */

/**
 * @typedef { MaplatCompiledLegacy0 } MaplatCompiledLegacy1
 * @property { string } version Version of Maplat Compiled data scheme
 * @property { Coordinate2D } wh Size of image (width, height)
 */

/**
 * @typedef { MaplatCompiledLegacy0 & MaplatCompiledLegacy1 } MaplatCompiledLegacy
 */

/**
 * @typedef { Object } MaplatSpecLegacyBase
 * @property { LocaleFragment } title Title of Map (In short)
 * @property { LocaleFragment } [officialTitle] Official Title of Map (In long)
 * @property { LocaleFragment } attr Attribution of map image
 * @property { LocaleFragment } [dataAttr] Attribution of mapping
 * @property { LocaleFragment } author Author of the map
 * @property { LocaleFragment } [contributor] Contributor/Owner of the map
 * @property { LocaleFragment } [mapper] Mapper of the mapping
 * @property { LocaleFragment } [description] Description of map
 * @property { MapLicense } license License of map
 * @property { DataLicense } dataLicense License of mapping data
 * @property { LocaleFragment } createdAt The date of map was created
 * @property { LocaleFragment } [era] The era described in the map
 * @property { string } reference Reference or source of map image
 * @property { string } lang Default language
 * @property { string } [mapID] ID of map
 * @property { string } [url] URL of template of image tile data
 * @property { string } extension String of image's extension
 * @property { Array<Object> } sub_maps Array of sub maps
 * @property { LegacyMapType } [maptype] Type of map (Legacy)
 * @property { number } [mercatorXShift] X shift of mercator projection
 * @property { number } [mercatorYShift] Y shift of mercator projection
 * @property { Array<Coordinate2D> } [envelopLngLats] Long Lat envelop of WMTS map
 *
 */

/**
 * @typedef { MaplatSpecLegacyBase } MaplatSpecLegacy0
 * @property { MaplatLegacyCompiled0 } compiled Maplat Compiled data
 * @property { number } width Width of image
 * @property { number } height Height of image
 */

/**
 * @typedef { MaplatSpecLegacyBase } MaplatSpecLegacy1
 * @property { MaplatLegacyCompiled1 } compiled Maplat Compiled data
 */

/**
 * @typedef { MaplatSpecLegacy0 | MaplatSpecLegacy1 } MaplatSpecLegacy
 */
