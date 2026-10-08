import type {NodeMaterialParameters} from 'three/webgpu';
import type {SpriteFeature} from '../SpriteFeature.js';
import {checkPass} from './passFeatures.js';

/**
 * Another way to draw the sprites of a kind: the same pool and geometry, a material of its own.
 * A pass adds the stages of its features and leaves out those of the kind's features named in
 * `without`; its features bring stages, uniforms and textures, never data.
 */
export interface SpritePass {
  readonly name: string;
  readonly features: readonly SpriteFeature[];
  /** Features of the kind, by name, whose stages this pass leaves out. */
  readonly without?: readonly string[];
  /** three.js material parameters of the pass: `transparent`, `depthWrite`, `polygonOffset`, … */
  readonly material?: Omit<NodeMaterialParameters, 'positionNode' | 'colorNode'>;
  /** Drawn before the sprites with a lower value; a shadow takes a negative one. */
  readonly renderOrder?: number;
}

/**
 * Checks a pass and freezes it: a name, features of distinct names, features that bring no data —
 * no attributes, methods, `initialize`, usage aliases or placement — and a `without` that names no
 * feature twice. It freezes copies of `features`, `without` and `material`, so the arrays and the
 * object handed in stay the caller's. What can only be checked against a sprite kind,
 * `FeatureSpritesMaterial` checks when it is built for the pass.
 */
export function definePass(pass: SpritePass): SpritePass {
  checkPass(pass, 'definePass');
  const {without, material} = pass;
  return Object.freeze({
    ...pass,
    features: Object.freeze([...pass.features]),
    ...(without != null && {without: Object.freeze([...without])}),
    ...(material != null && {material: Object.freeze({...material})}),
  });
}
