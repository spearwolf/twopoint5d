import type {AnimationPlayback} from './FrameBasedAnimations.js';

// the playbacks FrameBasedAnimations#add() and AsepriteJson.parse() take; a module of its own,
// because FrameBasedAnimations.ts is public through `export *`
export const ANIMATION_PLAYBACKS: readonly AnimationPlayback[] = ['loop', 'once', 'pingpong'];

export const isAnimationPlayback = (value: unknown): value is AnimationPlayback =>
  ANIMATION_PLAYBACKS.includes(value as AnimationPlayback);
