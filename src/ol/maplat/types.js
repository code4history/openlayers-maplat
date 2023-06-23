/**
 * @module ol/maplat/types
 */

/** 
 * @typedef { {[key: String]: String} } LocaleDictFragment
 */

/** 
 * @typedef { LocaleDictFragment | String } LocaleFragment
 */

/** 
 * @typedef { [number, number] } Coordinate2D
 */

/** 
 * @typedef { "All right reserved" | "CC BY" | "CC BY-SA" | "CC BY-ND" | "CC BY-NC" | "CC BY-NC-SA" | "CC BY-NC-ND" | "CC0" } LicenseSelection
 */

/**
 * @typedef { Object } MaplatMetaData
 * @property { String } lang Default language
 * @property { String } mapID ID of map
 * @property { LocaleFragment } title Title of Map (In short)
 * @property { LocaleFragment } [officialTitle] Official Title of Map (In long)
 * @property { LocaleFragment } attr Attribution of map image
 * @property { LocaleFragment } [dataAttr] Attribution of mapping
 * @property { LocaleFragment } author Author of the map
 * @property { LocaleFragment } [contributor] Contributor/Owner of the map
 * @property { LocaleFragment } [mapper] Mapper of the mapping
 * @property { LocaleFragment } [description] Description of map
 * @property { LicenseSelection | "PD" } license License of map
 * @property { LicenseSelection } dataLicense License of mapping data
 * @property { LocaleFragment } createdAt The date of map was created
 * @property { LocaleFragment } [era] The era described in the map
 * @property { String } reference Reference or source of map image
 * 
 */

/**
 * @typedef { Object } MaplatWorldParams
 * @property { number } xScale Scale factor of X param - a
 * @property { number } yRotation Rotation factor of Y param - d
 * @property { number } xRotation Rotation factor of X param - b
 * @property { number } yScale Scale factor of Y param - e
 * @property { number } xOrigin Origin factor of X param - c
 * @property { number } yOrigin Origin factor of Y param - f
 * 
 */

/**
 * @typedef { Object } MaplatProjectionSpec
 * @property { Coordinate2D } [size] Size of image in pixel
 * @property { String } mapCoord Coordinate name of map
 * @property { MaplatWorldParams } [worldParams] World parameter transforming pixel to map coord
 * @property { String } interOperationCode Coordinate for coordinate inter operability
 * 
 */

/**
 * @typedef { Object } MaplatSourceSpec
 * @property { "PIXEL" | "WMTS" | "TMS" | "IIIF" } tileSourceType Type of tile source
 * @property { "WARP" | "NONE" } warp Do map image warping or not
 * @property { String } [url] URL of template of image tile data 
 * @property { String } extension String of image's extension
 * 
 */

/**
 * @typedef { Object } MaplatDefinition
 * @property { String } version Maplat definition data scheme version
 * @property { String } mapID ID of map
 * @property { MaplatMetaData } metaData Maplat's metadata of image
 * @property { MaplatProjectionSpec } projectionSpec Map's projection spec
 * @property { MaplatSourceSpec } sourceSpec Map's source spec
 * 
 */