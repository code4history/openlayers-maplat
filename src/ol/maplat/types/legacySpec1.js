/**
 * @module ol/maplat/types/legacySpec1
 */

/**
 * @typedef { Object } MaplatLegacyCompiled1
 * @property { string } version Version of Maplat Compiled data scheme
 */

/**
 * @typedef { Object } MaplatLegacySpec1
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
 * @property { MaplatLegacyCompiled1 } compiled Maplat Compiled data
 */

/* 
    "title": "わくわく里沼ビレッジ周遊マップ",
    "attr": "(c) ONOTOKO 2023",
    "officialTitle": "",
    "dataAttr": "",
    "author": "ONOTOKO",
    "createdAt": "2023",
    "era": "",
    "license": "All right reserved",
    "dataLicense": "CC BY-SA",
    "contributor": "館林市「里沼」",
    "mapper": "Kohei Otsuka",
    "reference": "わくわく里沼ビレッジフライヤー",
    "description": "",
    "url": "https://t.tilemap.jp/maplat/tiles/tatebayashi_satonuma_village_1/{z}/{x}/{y}.jpg",
    "lang": "ja",


*/