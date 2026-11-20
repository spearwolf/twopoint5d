import {animationFrameAt} from '../texture/animationFrameAt.js';
import {describeValue} from '../utils/describeValue.js';
import {unfilledInternal} from '../utils/unfilledInternal.js';
import type {VO} from '../vertex-objects/types.js';
import type {ArtPose} from './artPose.js';
import type {ArtTagSpec} from './artSources.js';
import type {ArtTrack} from './artTrack.js';
import type {StageArt} from './StageArt.js';
import type {StageArtSpriteApi} from './stageArtKind.js';

/** What a layer read out of its source: set once, when its art loads. @internal */
export interface ArtLayerInfo {
  readonly box: Readonly<{x: number; y: number; w: number; h: number}>;
  readonly pivot: readonly [number, number];
  readonly rest: Readonly<Required<ArtPose>>;
  readonly frameCount: number;
  readonly tags: ReadonlyMap<string, ArtTagSpec>;
  readonly tagNames: readonly string[];
  /** Whether a picture of the layer is there. */
  readonly loaded: boolean;
}

/**
 * The functions through which a `StageArt` makes and fills its layer handles, and through which a
 * handle hands its calls to its art; they are not part of the public API. `StageArt` fills the
 * second half from its `static` block, `ArtLayer` the first.
 * @internal
 */
export const ArtLayerInternals: {
  create(art: StageArt, index: number, name: string, sprite: StageArtSpriteApi & VO): ArtLayer;
  adopt(layer: ArtLayer, info: ArtLayerInfo): void;
  set(art: StageArt, index: number, pose: ArtPose): void;
  apply(art: StageArt, index: number, track: ArtTrack, seconds: number): void;
  reset(art: StageArt, index: number): void;
} = {
  create: unfilledInternal('ArtLayerInternals.create()'),
  adopt: unfilledInternal('ArtLayerInternals.adopt()'),
  set: unfilledInternal('ArtLayerInternals.set()'),
  apply: unfilledInternal('ArtLayerInternals.apply()'),
  reset: unfilledInternal('ArtLayerInternals.reset()'),
};

// what ArtLayerInternals.create() hands the constructor, which takes no arguments: the declaration of
// the class names no type that is internal to the library
let pending: {art: StageArt; index: number; name: string; sprite: StageArtSpriteApi & VO} | undefined;

/**
 * The handle of one layer of a {@link StageArt}, the one a hot path keeps: `art.layer(name)` answers
 * it, the same object for the life of the art. A handle is made by its art, not by `new ArtLayer()`.
 *
 * `rest`, `box` and `pivot` are `undefined`, `frameCount` is 0 and `tags` is empty until the source
 * of the art has loaded; a layer the source lacks keeps them so. Once the art is disposed, `set()`,
 * `apply()` and `reset()` do nothing; the rest answers what it held.
 */
export class ArtLayer {
  /** The name of the layer, as the source or `only` names it. */
  readonly name: string;
  /**
   * The sprite of the layer in the mesh of the art — the handle a `SpritePicker` answers, and the way
   * to a feature handed in through the options. A write through it is the caller's: it goes past the
   * change detection of the art and its next pose overwrites what it shares with one.
   */
  readonly sprite: StageArtSpriteApi & VO;

  readonly #art: StageArt;
  readonly #index: number;
  readonly #subject: string;
  #info: ArtLayerInfo | undefined;

  static {
    ArtLayerInternals.create = (art, index, name, sprite) => {
      pending = {art, index, name, sprite};
      try {
        return new ArtLayer();
      } finally {
        pending = undefined;
      }
    };
    ArtLayerInternals.adopt = (layer, info) => {
      layer.#info = info;
    };
  }

  protected constructor() {
    const init = pending;
    if (init === undefined) throw new Error('ArtLayer: a layer handle is made by its StageArt — art.layer(name) answers it');
    this.#art = init.art;
    this.#index = init.index;
    this.name = init.name;
    this.sprite = init.sprite;
    this.#subject = `ArtLayer ${describeValue(init.name)}`;
  }

  /** The pose of the layout, frozen — every field of it —; `undefined` until the source has loaded. */
  get rest(): Readonly<Required<ArtPose>> | undefined {
    return this.#info?.rest;
  }

  /** Where the picture of the layer lies on the canvas, in artwork pixels — the union of its frames. */
  get box(): Readonly<{x: number; y: number; w: number; h: number}> | undefined {
    return this.#info?.box;
  }

  /** The point the layer stands on and turns about, in artwork pixels on the canvas. */
  get pivot(): readonly [number, number] | undefined {
    return this.#info?.pivot;
  }

  /** How many frames the layer has: an empty cel counts. */
  get frameCount(): number {
    return this.#info?.frameCount ?? 0;
  }

  /** The names of the tags of the layer, for {@link frameAt}. */
  get tags(): readonly string[] {
    return this.#info?.tagNames ?? [];
  }

  /** Whether a picture of the layer has arrived; `false` before the load and for a layer without one. */
  get loaded(): boolean {
    return this.#info?.loaded ?? false;
  }

  /** `art.set(layer.name, pose)`, without the look-up of the name. */
  set(pose: ArtPose): void {
    ArtLayerInternals.set(this.#art, this.#index, pose);
  }

  /** `art.apply(layer.name, track, seconds)`, without the look-up of the name. */
  apply(track: ArtTrack, seconds: number): void {
    ArtLayerInternals.apply(this.#art, this.#index, track, seconds);
  }

  /** Puts the layer back to its rest. Before the load it forgets the fields set so far. */
  reset(): void {
    ArtLayerInternals.reset(this.#art, this.#index);
  }

  /**
   * The frame of the layer that the tag `tag` shows `seconds` into it — an index into the frames of
   * the layer, ready for `set({frame})` —, with the playback and the durations of the tag
   * (`animationFrameAt()`). Allocates nothing.
   *
   * @throws an `Error` for a tag the layer does not have, listing the ones it has, and what
   *   `animationFrameAt()` refuses of `seconds`
   */
  frameAt(tag: string, seconds: number): number {
    const spec = this.#info?.tags.get(tag);
    if (spec === undefined) this.#refuseTag(tag);
    return spec.frames[animationFrameAt(spec, seconds)]!;
  }

  #refuseTag(tag: string): never {
    const info = this.#info;
    const known =
      info === undefined
        ? 'the layer has not loaded yet; await art.loaded'
        : info.tagNames.length === 0
          ? 'the layer has no tags'
          : `its tags are ${info.tagNames.map((name) => describeValue(name)).join(', ')}`;
    throw new Error(`${this.#subject}: no tag ${describeValue(tag)} — ${known}`);
  }
}
