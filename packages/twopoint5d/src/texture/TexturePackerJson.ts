import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';

export interface TexturePackerFrameData {
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface TexturePackerMetaData {
  image: string;
  size: {
    w: number;
    h: number;
  };
  // TODO add textureOptions: TextureClasses[]
}

export interface TexturePackerJsonData {
  frames: {
    [frameName: string]: TexturePackerFrameData;
  };
  meta: TexturePackerMetaData;
}

export class TexturePackerJson {
  static parse(
    data: TexturePackerJsonData,
    parentCoords?: TextureCoords,
    target?: TextureAtlas,
  ): [atlas: TextureAtlas, meta: TexturePackerMetaData] {
    target ??= new TextureAtlas();

    parentCoords ??= new TextureCoords(0, 0, data.meta.size.w, data.meta.size.h);

    for (const [name, {frame}] of Object.entries(data.frames)) {
      target.add(name, new TextureCoords(parentCoords, frame.x, frame.y, frame.w, frame.h));
    }

    return [target, data.meta];
  }
}
