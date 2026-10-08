import type {SpriteKind} from '../defineSprite.js';
import type {SpriteFeature} from '../SpriteFeature.js';
import type {SpritePass} from './definePass.js';

const DATA_FIELDS = ['attributes', 'methods', 'initialize', 'usageAliases', 'placement'] as const;

/**
 * Checks what a pass can be checked for on its own, in the words of `where`: a name, features of
 * distinct names that bring no data, and a `without` that names no feature twice. `definePass()`
 * runs it, and so does every place that takes a pass, since a plain object passes for one.
 *
 * @internal
 */
export function checkPass(pass: SpritePass, where: string): void {
  if (typeof pass.name !== 'string' || pass.name === '') throw new TypeError(`${where}: a pass needs a name`);
  const names = new Set<string>();
  for (const feature of pass.features) {
    if (names.has(feature.name)) throw new TypeError(`${where}: pass "${pass.name}" lists feature "${feature.name}" twice`);
    names.add(feature.name);
    for (const field of DATA_FIELDS) {
      if (feature[field] != null) {
        throw new TypeError(
          `${where}: feature "${feature.name}" of pass "${pass.name}" brings ${field}; a pass draws the data of the sprites and brings stages, uniforms and textures alone`,
        );
      }
    }
  }
  const left = new Set<string>();
  for (const name of pass.without ?? []) {
    if (left.has(name)) throw new TypeError(`${where}: pass "${pass.name}" leaves out feature "${name}" twice`);
    left.add(name);
  }
}

/**
 * The features a material of `pass` over `kind` is built from: those of the kind, without the
 * ones `without` names, plus those of the pass. Checks the pass on its own first, as `definePass()`
 * does — a plain object passes for a pass — and then against the kind.
 *
 * @internal
 */
export function passFeatures(kind: SpriteKind, pass: SpritePass, where: string): readonly SpriteFeature[] {
  checkPass(pass, where);
  const held = new Set(kind.features.map(({name}) => name));
  for (const left of pass.without ?? []) {
    if (!held.has(left))
      throw new Error(`${where}: pass "${pass.name}" leaves out feature "${left}", which the sprite kind does not hold`);
    if (left === kind.pipeline.placement!.name) {
      throw new Error(
        `${where}: pass "${pass.name}" leaves out the placement "${left}"; a pass draws with the placement of the sprites`,
      );
    }
  }
  const passNames = new Set(pass.features.map(({name}) => name));
  for (const feature of pass.features) {
    for (const required of feature.requires ?? []) {
      if (!held.has(required) && !passNames.has(required)) {
        throw new Error(
          `${where}: feature "${feature.name}" of pass "${pass.name}" requires feature "${required}", which neither the sprite kind nor the pass holds`,
        );
      }
    }
  }
  const without = new Set(pass.without ?? []);
  // the data features of the kind stay: a pass leaves out stages, and they bring none
  return Object.freeze([...kind.features.filter(({name}) => !without.has(name)), ...pass.features]);
}
