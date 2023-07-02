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
  static factoryMaplatSource(settings, options) {
    options.mapID = settings.mapID;
    options.settings = settings;

    if (!options.size) {
      options.size =
        'width' in settings && 'height' in settings
          ? [settings.width, settings.height]
          : // @ts-ignore
            settings.compiled.wh;
    }
    if ('url' in settings) {
      options.url = settings.url;
    }

    return new Maplat(options);
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
