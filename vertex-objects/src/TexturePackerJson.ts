import {TextureAtlas} from './TextureAtlas';
import {TextureCoords} from './TextureCoords';

/**
 * @category Texture Mapping
 */
export interface TexturePackerFrameData {
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

/**
 * @category Texture Mapping
 */
export interface TexturePackerMetaData {
  image: string;
  size: {
    w: number;
    h: number;
  };
  // TODO add textureOptions: TextureClasses[]
}

/**
 * @category Texture Mapping
 */
export interface TexturePackerJsonData {
  frames: {
    [frameName: string]: TexturePackerFrameData;
  };
  meta: TexturePackerMetaData;
}

/**
 * @category Texture Mapping
 */
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
