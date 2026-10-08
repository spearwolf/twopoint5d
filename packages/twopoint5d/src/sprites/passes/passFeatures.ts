import type {SpriteKind} from '../defineSprite.js';
import type {SpriteFeature} from '../SpriteFeature.js';
import type {SpritePass} from './definePass.js';

/**
 * The features a material of `pass` over `kind` is built from: those of the kind, without the
 * ones `without` names, plus those of the pass.
 *
 * @internal
 */
export function passFeatures(kind: SpriteKind, pass: SpritePass, where: string): readonly SpriteFeature[] {
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
