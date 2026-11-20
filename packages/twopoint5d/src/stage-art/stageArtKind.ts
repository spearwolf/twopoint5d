import {defineSprite, type SpriteApiOf, type SpriteKind} from '../sprites/defineSprite.js';
import {Anchor, type AnchorApi} from '../sprites/features/Anchor.js';
import {AtlasFrame, type AtlasFrameApi} from '../sprites/features/AtlasFrame.js';
import {Fade, type FadeApi} from '../sprites/features/Fade.js';
import {FlatPlacement} from '../sprites/features/FlatPlacement.js';
import {InstancePosition, type InstancePositionApi} from '../sprites/features/InstancePosition.js';
import {QuadSize, type QuadSizeApi} from '../sprites/features/QuadSize.js';
import {Rotation, type RotationApi} from '../sprites/features/Rotation.js';
import {TextureColor} from '../sprites/features/TextureColor.js';
import {Visible, type VisibleApi} from '../sprites/features/Visible.js';
import {QuadBase} from '../sprites/SpriteBase.js';
import {defineFeature, type SpriteFeature} from '../sprites/SpriteFeature.js';

/**
 * The sprite handle of an art layer: where it stands, its size, anchor, turn, frame, fade and
 * visibility, and `artOrder`, the key of its place in the stack.
 */
export type StageArtSpriteApi = InstancePositionApi &
  QuadSizeApi &
  AnchorApi &
  RotationApi &
  AtlasFrameApi &
  FadeApi &
  VisibleApi & {
    /**
     * `(order + 1024) · 8192 + index`: the stacking order of the layer among layers of one depth,
     * then its place in the painting. Read from the buffer by the sort; no shader reads it.
     */
    artOrder: number;
  };

/**
 * The api the features `Features` of an art add to the sprite handle of its layers: the
 * intersection of their apis, as `defineSprite()` derives it; `object` for an art without any.
 */
export type StageArtExtraApi<Features extends SpriteFeature> = [Features] extends [never]
  ? object
  : SpriteApiOf<readonly Features[]>;

/** The order key of an art layer: an attribute without a stage, which `sortBy('artOrder')` reads. */
export const ArtOrder = defineFeature<{artOrder: number}>({name: 'artOrder', attributes: {artOrder: {size: 1}}});

const FEATURES: readonly SpriteFeature[] = [
  InstancePosition,
  FlatPlacement,
  QuadSize,
  Anchor,
  Rotation,
  AtlasFrame,
  TextureColor,
  Fade,
  Visible,
  ArtOrder,
];

let defaultKind: SpriteKind<StageArtSpriteApi> | undefined;
// the kinds built for a list of further features, by the first of them: an entry lives as long as
// that feature object does, so an art made with a fresh factory call (paletteSwap({…})) leaves nothing
// behind once it and its feature are gone
const extraKinds = new WeakMap<object, {features: readonly SpriteFeature[]; kind: SpriteKind<StageArtSpriteApi>}[]>();

/** The names of the features every layer of an art has; a feature of `features` may not take one. */
export const ART_FEATURE_NAMES: readonly string[] = FEATURES.map((feature) => feature.name);

const sameFeatures = (a: readonly SpriteFeature[], b: readonly SpriteFeature[]): boolean =>
  a.length === b.length && a.every((feature, i) => feature === b[i]);

/**
 * The sprite kind of an art: the features every layer needs, then `features`. The kind without
 * further features is built once and shared by every art, and a kind with them is built once per
 * distinct list of feature objects, kept as long as the first of them lives — hoist the call of a
 * feature factory to share the kind; a feature `defineSprite()` refuses throws in its words.
 */
export function stageArtKind(features: readonly SpriteFeature[]): SpriteKind<StageArtSpriteApi> {
  if (features.length === 0) {
    defaultKind ??= defineSprite({base: QuadBase, features: FEATURES}) as SpriteKind<StageArtSpriteApi>;
    return defaultKind;
  }
  const first = features[0]!;
  // a first entry that is no object is no key: it is no feature, and defineSprite() refuses it below
  const entries = typeof first === 'object' && first !== null ? extraKinds.get(first) : undefined;
  const known = entries?.find((entry) => sameFeatures(entry.features, features));
  if (known !== undefined) return known.kind;
  const kind = defineSprite({base: QuadBase, features: [...FEATURES, ...features]}) as SpriteKind<StageArtSpriteApi>;
  const entry = {features: Object.freeze([...features]), kind};
  if (entries === undefined) extraKinds.set(first, [entry]);
  else entries.push(entry);
  return kind;
}
