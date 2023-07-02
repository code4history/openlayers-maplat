/**
 * @module ol/maplat/source/Factory
 */
import Maplat from './Maplat.js';

class Factory {
  /**
   * @param {MaplatDefinition | MaplatSpecLegacy} settings Settings of Maplat
   * @param {import('ol/source/TileImage.js').Options} options Options for ol/source/TileImage
   * @return import('./Maplat.js').default;
   */
  static factoryMaplatSource(settings, options = {}) {
    /** @type {import('./Maplat.js').maplatOptions} */
    // @ts-ignore
    const maplatOptions = options;

    maplatOptions.mapID = settings.mapID;
    maplatOptions.settings = settings;

    if (!('size' in maplatOptions)) {
      maplatOptions.size =
        'width' in settings && 'height' in settings
          ? [settings.width, settings.height]
          : // @ts-ignore
            settings.compiled.wh;
    }
    if (!('url' in maplatOptions)) {
      maplatOptions.url = settings.url;
    }

    return new Maplat(maplatOptions);
  }

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

export default Factory;
