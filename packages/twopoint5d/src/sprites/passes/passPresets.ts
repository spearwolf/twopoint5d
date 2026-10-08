import {Darken} from './Darken.js';
import {definePass} from './definePass.js';
import {MirrorAtPlane} from './MirrorAtPlane.js';
import {PlanarShadow} from './PlanarShadow.js';
import {ShadowMask} from './ShadowMask.js';

/** A planar shadow behind the sprites: projected onto `groundPlane`, in `shadowColor`. */
export const ShadowPass = definePass({
  name: 'shadow',
  features: [PlanarShadow, ShadowMask],
  material: {transparent: true, depthWrite: false},
  renderOrder: -1,
});

/** A reflection behind the sprites: mirrored at `mirrorPlane`, multiplied by `reflectionColor`. */
export const ReflectionPass = definePass({
  name: 'reflection',
  features: [MirrorAtPlane, Darken],
  material: {transparent: true, depthWrite: false},
  renderOrder: -1,
});
