import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';

export interface TexturePackerFrameData {
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /**
   * `true` if the packer laid the sprite into the sheet turned by 90° clockwise. Then `frame.w` and `frame.h`
   * are the measures of the sprite as it is drawn, and in the sheet it takes `h` × `w` pixels from `frame.x`/`frame.y`.
   */
  rotated?: boolean;
}

/** A frame of the "JSON Array" format, which names itself by `filename`. */
export interface TexturePackerArrayFrameData extends TexturePackerFrameData {
  filename: string;
}

export interface TexturePackerMetaData {
  image: string;
  size: {
    w: number;
    h: number;
  };
}

export interface TexturePackerJsonData {
  /**
   * The frames in the "JSON Hash" format (the name is the key) or in the "JSON Array" format (the name is the `filename`).
   */
  frames: Record<string, TexturePackerFrameData> | TexturePackerArrayFrameData[];
  meta: TexturePackerMetaData;
}

export class TexturePackerJson {
  /**
   * @throws {Error} if a frame name appears more than once in the json or is already taken in the `target`;
   * the `target` stays as it was.
   */
  static parse(
    data: TexturePackerJsonData,
    parentCoords?: TextureCoords,
    target?: TextureAtlas,
  ): [atlas: TextureAtlas, meta: TexturePackerMetaData] {
    target ??= new TextureAtlas();

    parentCoords ??= new TextureCoords(0, 0, data.meta.size.w, data.meta.size.h);

    const entries: [name: string, frameData: TexturePackerFrameData][] = Array.isArray(data.frames)
      ? data.frames.map((frameData) => [frameData.filename, frameData])
      : Object.entries(data.frames);

    // every name is checked before the first add(), so a refused json leaves the target as it was
    const names = new Set<string>();
    for (const [name] of entries) {
      if (names.has(name)) {
        throw new Error(`TexturePackerJson: the frame name "${name}" appears more than once in the json`);
      }
      if (target.frameId(name) !== undefined) {
        throw new Error(`TexturePackerJson: the frame name "${name}" is already taken in the target atlas`);
      }
      names.add(name);
    }

    for (const [name, {frame, rotated}] of entries) {
      if (rotated === true) {
        // the sprite lies in the sheet turned by 90°: the area there is `h` wide and `w` high. The diagonal
        // plus the vertical flip turns it back when it is drawn.
        const coords = new TextureCoords(parentCoords, frame.x, frame.y, frame.h, frame.w);
        coords.flip = TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL;
        target.add(name, coords);
      } else {
        target.add(name, new TextureCoords(parentCoords, frame.x, frame.y, frame.w, frame.h));
      }
    }

    return [target, data.meta];
  }
}
