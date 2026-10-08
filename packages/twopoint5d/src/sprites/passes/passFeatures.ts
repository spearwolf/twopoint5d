import type {SpriteKind} from '../defineSprite.js';
import type {SpriteFeature} from '../SpriteFeature.js';
import type {SpritePass} from './definePass.js';
import {stageFeaturesOf} from './passUniformNames.js';

const DATA_FIELDS = ['attributes', 'methods', 'initialize', 'usageAliases'] as const;

/**
 * The feature of `pass` that brings a placement, `undefined` for a pass that draws with the
 * placement of the sprites. @internal
 */
export const placementOfPass = (pass: SpritePass): SpriteFeature | undefined =>
  pass.features.find((feature) => feature.placement != null);

/**
 * Checks what a pass can be checked for on its own, in the words of `where`: a name, features of
 * distinct names that bring no data and at most one placement among them, and a `without` that
 * names no feature twice. `definePass()` runs it, and so does every place that takes a pass, since
 * a plain object passes for one.
 *
 * @internal
 */
export function checkPass(pass: SpritePass, where: string): void {
  if (typeof pass.name !== 'string' || pass.name === '') throw new TypeError(`${where}: a pass needs a name`);
  if (pass.visible != null && typeof pass.visible !== 'function') {
    throw new TypeError(`${where}: the visible of pass "${pass.name}" is no function`);
  }
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
  const placements = pass.features.filter((feature) => feature.placement != null);
  if (placements.length > 1) {
    const names = placements.map((feature) => `"${feature.name}"`).join(' and ');
    throw new TypeError(`${where}: features ${names} of pass "${pass.name}" each bring a placement; a pass takes at most one`);
  }
  const left = new Set<string>();
  for (const name of pass.without ?? []) {
    if (left.has(name)) throw new TypeError(`${where}: pass "${pass.name}" leaves out feature "${name}" twice`);
    left.add(name);
  }
  // own keys only: a member of Object.prototype such as "toString" is no uniform of a feature
  const declares = (name: string) => pass.features.some(({uniforms}) => uniforms != null && Object.hasOwn(uniforms, name));
  const targets = new Map<string, string>();
  for (const [name, target] of Object.entries(pass.uniformNames ?? {})) {
    if (!declares(name)) {
      throw new TypeError(`${where}: pass "${pass.name}" renames the uniform "${name}", which no feature of the pass declares`);
    }
    if (typeof target !== 'string') {
      throw new TypeError(`${where}: pass "${pass.name}" renames the uniform "${name}" to a name that is not a string`);
    }
    if (target === '') {
      throw new TypeError(`${where}: pass "${pass.name}" renames the uniform "${name}" to an empty name`);
    }
    if (target !== name && declares(target)) {
      throw new TypeError(
        `${where}: pass "${pass.name}" renames the uniform "${name}" to "${target}", which a feature of the pass declares`,
      );
    }
    const first = targets.get(target);
    if (first != null) {
      throw new TypeError(`${where}: pass "${pass.name}" renames the uniforms "${first}" and "${name}" both to "${target}"`);
    }
    targets.set(target, name);
  }
}

// one copy per placement feature of a kind, so that every pass material sees the same object
const placementlessCopies = new WeakMap<SpriteFeature, SpriteFeature>();

const withoutPlacement = (feature: SpriteFeature): SpriteFeature => {
  let copy = placementlessCopies.get(feature);
  if (copy == null) {
    const {placement: _placement, ...rest} = feature;
    copy = Object.freeze(rest);
    placementlessCopies.set(feature, copy);
  }
  return copy;
};

/**
 * The features a material of `pass` over `kind` is built from: those of the kind, without the
 * ones `without` names, plus those of the pass. A pass that brings a placement draws with it: the
 * placement feature of the kind stays, without its placement stage. Checks the pass on its own
 * first, as `definePass()` does — a plain object passes for a pass — and then against the kind.
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
        `${where}: pass "${pass.name}" leaves out the placement "${left}"; a pass draws with the placement of the sprites or brings one of its own`,
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
  const kindPlacement = kind.pipeline.placement!;
  const own = placementOfPass(pass) != null;
  // the data features of the kind stay: a pass leaves out stages, and they bring none
  const kept = kind.features
    .filter(({name}) => !without.has(name))
    .map((feature) => (own && feature === kindPlacement ? withoutPlacement(feature) : feature));
  return Object.freeze([...kept, ...stageFeaturesOf(pass)]);
}
