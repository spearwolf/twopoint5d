import type {NodeMaterialParameters} from 'three/webgpu';
import type {SpriteFeature} from '../SpriteFeature.js';

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

const DATA_FIELDS = ['attributes', 'methods', 'initialize', 'usageAliases', 'placement'] as const;

/**
 * Checks a pass and freezes it: a name, features of distinct names, and features that bring no
 * data — no attributes, methods, `initialize`, usage aliases or placement. What can only be checked
 * against a sprite kind, `FeatureSpritesMaterial` checks when it is built for the pass.
 */
export function definePass(pass: SpritePass): SpritePass {
  if (typeof pass.name !== 'string' || pass.name === '') throw new TypeError('definePass: a pass needs a name');
  const names = new Set<string>();
  for (const feature of pass.features) {
    if (names.has(feature.name)) throw new TypeError(`definePass: pass "${pass.name}" lists feature "${feature.name}" twice`);
    names.add(feature.name);
    for (const field of DATA_FIELDS) {
      if (feature[field] != null) {
        throw new TypeError(
          `definePass: feature "${feature.name}" of pass "${pass.name}" brings ${field}; a pass draws the data of the sprites and brings stages, uniforms and textures alone`,
        );
      }
    }
  }
  return Object.freeze({...pass, features: Object.freeze([...pass.features])});
}
