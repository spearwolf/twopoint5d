import {assertFinite} from '../utils/assertFinite.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeValue} from '../utils/describeValue.js';
import {isObject} from '../utils/isObject.js';
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
  /** `true` if the packer cut the transparent border off the sprite: `frame` is then the area that is left. */
  trimmed?: boolean;
  /** Where the area `frame` names lies in the sprite before it was trimmed. */
  spriteSourceSize?: {x: number; y: number; w: number; h: number};
  /** The size of the sprite before it was trimmed. */
  sourceSize?: {w: number; h: number};
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

const FRAME_KEYS = ['x', 'y', 'w', 'h'] as const;

export class TexturePackerJson {
  /**
   * Every frame carries its entry of the json as `data`, `trimmed`, `spriteSourceSize` and `sourceSize`
   * included. The `coords` of a trimmed frame are the trimmed area; the `setFrame()` of the `AtlasFrame`
   * sprite feature and an animation `FrameBasedAnimations#add()` builds from the atlas lay it where the
   * untrimmed sprite has it.
   *
   * `D` is the type of the frame entries: a json whose entries carry more than TexturePacker writes —
   * Aseprite's `duration` — keeps that type in the atlas `parse()` answers, and a `target` takes frames
   * of that type.
   *
   * Every frame is checked before the first one is added to the `target`.
   *
   * @throws {TypeError} if the json is no object, its `frames` are neither an object nor a list, a
   * frame is no object, its `frame` is no object, a frame of the "JSON Array" format has a
   * `filename` that is no string, or — without `parentCoords` — the json has no `meta.size`; the
   * `target` stays as it was.
   * @throws {RangeError} if an `x`, `y`, `w` or `h` of a `frame` is no finite number of 0 or more,
   * or — without `parentCoords` — the `w` or `h` of `meta.size` is no finite number above 0; the
   * `target` stays as it was.
   * @throws {Error} if a frame name appears more than once in the json or is already taken in the
   * `target`; the `target` stays as it was.
   */
  static parse<D extends TexturePackerFrameData = TexturePackerFrameData>(
    data: {frames: Record<string, D> | (D & {filename: string})[]; meta: TexturePackerMetaData},
    parentCoords?: TextureCoords,
    target?: TextureAtlas<D>,
  ): [atlas: TextureAtlas<D>, meta: TexturePackerMetaData] {
    target ??= new TextureAtlas<D>();

    if (!isObject(data)) {
      throw new TypeError(
        `TexturePackerJson: the json is ${describeValue(data)} — a texture atlas json is an object {frames, meta}`,
      );
    }
    const jsonFrames: unknown = data.frames;
    if (!Array.isArray(jsonFrames) && !isObject(jsonFrames)) {
      throw new TypeError(
        `TexturePackerJson: the json has frames of ${describeValue(jsonFrames)} — the frames are an object ("JSON Hash") or a list ("JSON Array")`,
      );
    }

    if (parentCoords === undefined) {
      const size: unknown = isObject(data.meta) ? data.meta.size : undefined;
      if (!isObject(size)) {
        throw new TypeError(
          `TexturePackerJson: the json has a meta.size of ${describeValue(size)} — without parentCoords the frames are laid out in meta.size, an object {w, h}`,
        );
      }
      const w = assertPositiveFinite(size['w'], 'TexturePackerJson', 'the w of meta.size');
      const h = assertPositiveFinite(size['h'], 'TexturePackerJson', 'the h of meta.size');
      parentCoords = new TextureCoords(0, 0, w, h);
    }

    const isArray = Array.isArray(data.frames);
    // the entries are read as a catalog may hand them in: a frame that is no object is refused below, by name
    // or by index, and a filename is only read from an object
    const entries: [name: unknown, frameData: unknown][] = Array.isArray(data.frames)
      ? data.frames.map((frameData: unknown) => [isObject(frameData) ? frameData['filename'] : undefined, frameData])
      : Object.entries(data.frames);

    // every frame is checked before the first add(), so a refused json leaves the target as it was
    const checked: [name: string, frameData: D][] = [];
    const names = new Set<string>();
    for (const [index, [name, frameData]] of entries.entries()) {
      if (!isObject(frameData)) {
        throw new TypeError(
          isArray
            ? `TexturePackerJson: the frame ${index} of the "JSON Array" frames is ${describeValue(frameData)} — a frame of the json is an object`
            : `TexturePackerJson: the frame "${name as string}" is ${describeValue(frameData)} — a frame of the json is an object`,
        );
      }
      // only a frame of the "JSON Array" format can miss its name: a key of the "JSON Hash" format is a string
      if (typeof name !== 'string') {
        throw new TypeError(
          `TexturePackerJson: the frame ${index} of the "JSON Array" frames has a filename of ${describeValue(name)} — a frame of that format is named by its filename, a string`,
        );
      }
      if (names.has(name)) {
        throw new Error(`TexturePackerJson: the frame name "${name}" appears more than once in the json`);
      }
      if (target.frameId(name) !== undefined) {
        throw new Error(`TexturePackerJson: the frame name "${name}" is already taken in the target atlas`);
      }
      names.add(name);

      const {frame} = frameData;
      if (!isObject(frame)) {
        throw new TypeError(
          `TexturePackerJson: the frame "${name}" has a frame of ${describeValue(frame)} — its area in the image is an object {x, y, w, h}`,
        );
      }
      for (const key of FRAME_KEYS) {
        // 0 is taken: a packer may write an area of 0 for a sprite that is transparent all over
        const value = assertFinite(frame[key], 'TexturePackerJson', `the ${key} of the frame "${name}"`);
        if (value < 0) {
          throw new RangeError(
            `TexturePackerJson: the ${key} of the frame "${name}" must be a finite number of 0 or more, got ${describeValue(value)}`,
          );
        }
      }
      // what the add() below reads of a frame is checked now
      checked.push([name, frameData as D]);
    }

    for (const [name, frameData] of checked) {
      const {frame, rotated} = frameData;
      if (rotated === true) {
        // the sprite lies in the sheet turned by 90°: the area there is `h` wide and `w` high. The diagonal
        // plus the vertical flip turns it back when it is drawn.
        const coords = new TextureCoords(parentCoords, frame.x, frame.y, frame.h, frame.w);
        coords.flip = TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL;
        target.add(name, coords, frameData);
      } else {
        target.add(name, new TextureCoords(parentCoords, frame.x, frame.y, frame.w, frame.h), frameData);
      }
    }

    return [target, data.meta];
  }
}
