import {DataTexture, FloatType, RGBAFormat} from 'three';
import {findNextPowerOf2} from '../utils/findNextPowerOf2.js';
import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TileSet} from './TileSet.js';

type AnimName = string | symbol;

export interface FrameBasedAnimDef {
  frames: TextureCoords[];
  duration: number;
  name: AnimName;
  id: number;
}

export interface BakeTextureOptions {
  includeTextureSize: boolean;
}

type AnimationsMap = Map<AnimName, FrameBasedAnimDef>;

const getBufferSize = (animationsMap: AnimationsMap, sizePerTexture = 1, maxTextureSize = 16384) => {
  const anims = Array.from(animationsMap.values());
  const totalFramesCount = anims.reduce((sum, anim) => sum + anim.frames.length, 0);
  const minBufSize = anims.length + totalFramesCount * sizePerTexture;
  const bufSize = findNextPowerOf2(minBufSize);

  if (bufSize > maxTextureSize) {
    throw new Error('TODO too many animation frames - we need better way here to calculate a corresponding buffer size!');
  }

  return bufSize;
};

const renderFloatsBuffer = (
  floatsBuffer: Float32Array,
  names: AnimName[],
  animations: AnimationsMap,
  includeTextureSize: boolean,
) => {
  let curOffset = names.length;

  floatsBuffer.set(
    names.flatMap((name) => {
      const {frames, duration} = animations.get(name)!;
      const offset = curOffset;
      curOffset += frames.length * (includeTextureSize ? 2 : 1);
      return [frames.length, duration, offset, 0];
    }),
  );

  floatsBuffer.set(
    includeTextureSize
      ? names.flatMap((name) =>
          animations.get(name)!.frames.flatMap(({s, t, u, v, width, height}) => [s, t, u, v, width, height, 0, 0]),
        )
      : names.flatMap((name) => animations.get(name)!.frames.flatMap(({s, t, u, v}) => [s, t, u, v])),
    names.length * 4,
  );

  return floatsBuffer;
};

export class FrameBasedAnimations {
  static MaxTextureSize = 16384;

  #animations: AnimationsMap = new Map();

  // we can not just use animations.keys() here, because we need a consistent name <-> id mapping
  #names: AnimName[] = [];

  add(
    // TODO support args without first anim-frame parameter
    ...args:
      | [
          name: AnimName | undefined,
          duration: number,
          // TODO support frameRate (fps) option as an alternative to duration
          texCoords: TextureCoords[],
        ]
      | [name: AnimName | undefined, duration: number, atlas: TextureAtlas, frameNameQuery?: string]
      | [name: AnimName | undefined, duration: number, tileSet: TileSet, firstTileId?: number, tileCount?: number]
      | [name: AnimName | undefined, duration: number, tileSet: TileSet, tileIds: number[]]
  ): number {
    let [name] = args;

    if (name) {
      if (this.#animations.has(name)) {
        throw new Error(`name='${name.toString()}' must be unique!`);
      }
    } else {
      name = Symbol('n/a');
    }

    let frames: TextureCoords[];

    if (Array.isArray(args[2])) {
      frames = args[2];
    } else if (args[2] instanceof TextureAtlas) {
      const atlas = args[2];
      const frameNames = atlas.frameNames(args[3] as any).sort();
      frames = frameNames.map((frameName) => atlas.frame(frameName)!.coords);
    } else if (args[2] instanceof TileSet) {
      const tileSet = args[2];
      if (Array.isArray(args[3])) {
        const tileIds = args[3];
        frames = tileIds.map((tileId) => tileSet.frame(tileId).coords);
      } else {
        const firstTileId = (args[3] as number | undefined) ?? tileSet.firstId;
        const tileCount: number = args[4] ?? tileSet.tileCount;
        frames = [];
        for (let tileId = firstTileId; tileId < firstTileId + tileCount; tileId++) {
          frames.push(tileSet.frame(tileId).coords);
        }
      }
    }

    const id = this.#names.length;
    const [, duration] = args;

    this.#names.push(name);
    this.#animations.set(name, {
      id,
      name,
      // @ts-ignore
      frames,
      duration,
    });

    return id;
  }

  animId(name: AnimName): number {
    return this.#animations.get(name)!.id;
  }

  bakeDataTexture(options?: BakeTextureOptions): DataTexture {
    const includeTextureSize = Boolean(options?.includeTextureSize);

    const bufSize = getBufferSize(this.#animations, includeTextureSize ? 2 : 1, FrameBasedAnimations.MaxTextureSize);

    const floatsBuffer = renderFloatsBuffer(new Float32Array(bufSize * 4), this.#names, this.#animations, includeTextureSize);

    const dataTexture = new DataTexture(floatsBuffer, bufSize, 1, RGBAFormat, FloatType);
    dataTexture.needsUpdate = true;

    return dataTexture;
  }
}
