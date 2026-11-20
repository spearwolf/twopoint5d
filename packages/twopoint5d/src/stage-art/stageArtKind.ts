import {defineSprite, type SpriteKind} from '../sprites/defineSprite.js';
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

/**
 * The sprite kind of an art: the features every layer needs, then `features`. The kind without
 * further features is built once and shared by every art; a feature `defineSprite()` refuses
 * throws in its words.
 */
export function stageArtKind(features: readonly SpriteFeature[]): SpriteKind<StageArtSpriteApi> {
  if (features.length === 0) {
    defaultKind ??= defineSprite({base: QuadBase, features: FEATURES}) as SpriteKind<StageArtSpriteApi>;
    return defaultKind;
  }
  return defineSprite({base: QuadBase, features: [...FEATURES, ...features]}) as SpriteKind<StageArtSpriteApi>;
}
