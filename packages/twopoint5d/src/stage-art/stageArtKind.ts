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

// a node of the kinds built for further features: the kind of the list that ends here, and the nodes of
// the lists one feature longer, by that feature
interface KindNode {
  kind?: SpriteKind<StageArtSpriteApi>;
  next?: WeakMap<object, KindNode>;
}

// a trie of weak maps, one level per feature object: the node of a list is reachable only while every
// feature of it lives, so an art made with a fresh factory call (paletteSwap({…})) — first or after a
// feature of a module — leaves nothing behind once it and its feature are gone
const extraKinds = new WeakMap<object, KindNode>();

/** The names of the features every layer of an art has; a feature of `features` may not take one. */
export const ART_FEATURE_NAMES: readonly string[] = FEATURES.map((feature) => feature.name);

// a feature is an object; an entry that is none is no key of a weak map, and defineSprite() refuses it
const isKey = (feature: unknown): feature is object => typeof feature === 'object' && feature !== null;

const buildKind = (features: readonly SpriteFeature[]): SpriteKind<StageArtSpriteApi> =>
  defineSprite({base: QuadBase, features: [...FEATURES, ...features]}) as SpriteKind<StageArtSpriteApi>;

/**
 * The sprite kind of an art: the features every layer needs, then `features`. The kind without
 * further features is built once and shared by every art, and a kind with them is built once per
 * distinct list of feature objects, kept as long as every one of them lives — hoist the call of a
 * feature factory to share the kind; a feature `defineSprite()` refuses throws in its words.
 */
export function stageArtKind(features: readonly SpriteFeature[]): SpriteKind<StageArtSpriteApi> {
  if (features.length === 0) {
    defaultKind ??= buildKind([]);
    return defaultKind;
  }
  if (!features.every(isKey)) return buildKind(features);
  let found = extraKinds.get(features[0]!);
  for (let i = 1; found !== undefined && i < features.length; i++) found = found.next?.get(features[i]!);
  if (found?.kind !== undefined) return found.kind;

  // built before anything is kept, so a list defineSprite() refuses leaves no node behind
  const kind = buildKind(features);
  let level = extraKinds;
  for (let i = 0; ; i++) {
    const feature = features[i]!;
    let node = level.get(feature);
    if (node === undefined) level.set(feature, (node = {}));
    if (i === features.length - 1) {
      node.kind = kind;
      return kind;
    }
    level = node.next ??= new WeakMap();
  }
}
