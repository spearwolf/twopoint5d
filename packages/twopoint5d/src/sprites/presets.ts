import {defineSprite} from './defineSprite.js';
import {AnimatedFrames} from './features/AnimatedFrames.js';
import {AtlasFrame} from './features/AtlasFrame.js';
import {FlatPlacement} from './features/FlatPlacement.js';
import {InstancePosition} from './features/InstancePosition.js';
import {QuadSize} from './features/QuadSize.js';
import {Rotation} from './features/Rotation.js';
import {TextureColor} from './features/TextureColor.js';
import {Tint} from './features/Tint.js';
import {QuadBase} from './SpriteBase.js';

/** Sprites that show a frame of an atlas, tinted by a color each: the textured sprites. */
export const TexturedSpriteKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint],
});

/**
 * Sprites that play a frame-based animation out of an `animsMap`. No `Tint`: the animated sprites
 * never had a color of their own, and a kind with one more feature is a `defineSprite()` away.
 */
export const AnimatedSpriteKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AnimatedFrames, TextureColor],
});
