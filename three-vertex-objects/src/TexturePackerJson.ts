import {TextureAtlas} from './TextureAtlas';
import {TextureCoords} from './TextureCoords';

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
    target?: TextureAtlas,
  ): [atlas: TextureAtlas, image: string] {
    target ??= new TextureAtlas();

    for (const [name, {frame}] of Object.entries(data.frames)) {
      target.add(name, new TextureCoords(frame.x, frame.y, frame.w, frame.h));
    }

    return [target, data.meta.image];
  }
}
