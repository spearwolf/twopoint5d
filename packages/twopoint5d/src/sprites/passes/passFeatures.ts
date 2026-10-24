import {assertFinite} from '../../utils/assertFinite.js';
import {describeValue} from '../../utils/describeValue.js';
import {isObject} from '../../utils/isObject.js';
import {checkFeature} from '../checkFeature.js';
import type {SpriteKind} from '../defineSprite.js';
import {runCheckKind} from '../runCheckKind.js';
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

const isRecord = (value: unknown): value is Record<string, unknown> => isObject(value) && !Array.isArray(value);

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/**
 * Checks what a pass can be checked for on its own, in the words of `where`: that it is an object
 * with a name, a `visible` that is a function, `features` that are a list of features of distinct
 * names, each checked as `defineFeature()` checks one, that bring no data and at most one placement
 * among them, a `without` that is a list of names and names no feature twice, `uniformNames` and
 * `material` that are objects, the renames among them sound, and a `renderOrder` that is a finite
 * number. A `without`, `uniformNames`, `material` or `renderOrder` of `null` is one the pass does
 * not bring. `definePass()` runs it, and so does every place that takes a pass, since a plain
 * object passes for one.
 *
 * @internal
 *
 * @throws a `TypeError` naming the pass and the field, a `RangeError` for a `renderOrder` that is no
 * finite number
 */
export function checkPass(pass: unknown, where: string): asserts pass is SpritePass {
  if (!isRecord(pass)) {
    throw new TypeError(`${where}: a pass is an object with a name and features, got ${describeValue(pass)}`);
  }
  const {name, visible, features, without, uniformNames, material, renderOrder} = pass;
  if (typeof name !== 'string' || name === '') throw new TypeError(`${where}: a pass needs a name`);
  if (visible != null && typeof visible !== 'function') {
    throw new TypeError(`${where}: the visible of pass "${name}" is no function`);
  }
  // an array and not any iterable: the code that draws the pass calls `find()`, `map()` and `filter()`
  if (!Array.isArray(features)) {
    throw new TypeError(`${where}: the features of pass "${name}" are no list of features, got ${describeValue(features)}`);
  }
  const names = new Set<string>();
  for (const feature of features) {
    checkFeature(feature, where);
    if (names.has(feature.name)) throw new TypeError(`${where}: pass "${name}" lists feature "${feature.name}" twice`);
    names.add(feature.name);
    for (const field of DATA_FIELDS) {
      if (feature[field] != null) {
        throw new TypeError(
          `${where}: feature "${feature.name}" of pass "${name}" brings ${field}; a pass draws the data of the sprites and brings stages, uniforms and textures alone`,
        );
      }
    }
  }
  const placements = (features as readonly SpriteFeature[]).filter((feature) => feature.placement != null);
  if (placements.length > 1) {
    const names = placements.map((feature) => `"${feature.name}"`).join(' and ');
    throw new TypeError(`${where}: features ${names} of pass "${name}" each bring a placement; a pass takes at most one`);
  }
  if (without != null) {
    if (!isStringList(without)) {
      throw new TypeError(`${where}: the without of pass "${name}" is no list of feature names, got ${describeValue(without)}`);
    }
    const left = new Set<string>();
    for (const leftOut of without) {
      if (left.has(leftOut)) throw new TypeError(`${where}: pass "${name}" leaves out feature "${leftOut}" twice`);
      left.add(leftOut);
    }
  }
  if (uniformNames != null && !isRecord(uniformNames)) {
    throw new TypeError(
      `${where}: the uniformNames of pass "${name}" are no record of uniform names, got ${describeValue(uniformNames)}`,
    );
  }
  if (material != null && !isRecord(material)) {
    throw new TypeError(
      `${where}: the material of pass "${name}" is no record of material parameters, got ${describeValue(material)}`,
    );
  }
  if (renderOrder != null) assertFinite(renderOrder, where, `the renderOrder of pass "${name}"`);
  // own keys only: a member of Object.prototype such as "toString" is no uniform of a feature
  const declares = (uniform: string) =>
    (features as readonly SpriteFeature[]).some(({uniforms}) => uniforms != null && Object.hasOwn(uniforms, uniform));
  const targets = new Map<string, string>();
  for (const [uniform, target] of Object.entries(uniformNames ?? {})) {
    if (!declares(uniform)) {
      throw new TypeError(`${where}: pass "${name}" renames the uniform "${uniform}", which no feature of the pass declares`);
    }
    if (typeof target !== 'string') {
      throw new TypeError(`${where}: pass "${name}" renames the uniform "${uniform}" to a name that is not a string`);
    }
    if (target === '') {
      throw new TypeError(`${where}: pass "${name}" renames the uniform "${uniform}" to an empty name`);
    }
    if (target !== uniform && declares(target)) {
      throw new TypeError(
        `${where}: pass "${name}" renames the uniform "${uniform}" to "${target}", which a feature of the pass declares`,
      );
    }
    const first = targets.get(target);
    if (first != null) {
      throw new TypeError(`${where}: pass "${name}" renames the uniforms "${first}" and "${uniform}" both to "${target}"`);
    }
    targets.set(target, uniform);
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
 * first, as `definePass()` does — a plain object passes for a pass — and then against the kind, the
 * `checkKind` of its features last, with the features it draws with.
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
  const folded = foldFeatures(kind, pass, kind.pipeline.placement!);
  runPassChecks(kind, pass, folded, where);
  return folded;
}

/**
 * Runs the `checkKind` of every feature of `pass` on the features a material of the pass over `kind`
 * folds when the sprites draw with `placement` in place of the placement of the kind, in the words
 * of `where` — what passFeatures() runs for the placement of the kind. @internal
 */
export function checkPassFeatures(kind: SpriteKind, pass: SpritePass, placement: SpriteFeature, where: string): void {
  runPassChecks(kind, pass, foldFeatures(kind, pass, placement), where);
}

// The features of the kind, without the ones `without` names, plus the stage features of the pass, with
// `placement` in the place of the placement of the kind. A pass that brings a placement draws with it:
// the placement feature stays, without its placement stage
function foldFeatures(kind: SpriteKind, pass: SpritePass, placement: SpriteFeature): readonly SpriteFeature[] {
  const without = new Set(pass.without ?? []);
  const kindPlacement = kind.pipeline.placement!;
  const stand = placementOfPass(pass) != null ? withoutPlacement(placement) : placement;
  // the data features of the kind stay: a pass leaves out stages, and they bring none
  const kept = kind.features
    .filter(({name}) => !without.has(name))
    .map((feature) => (feature === kindPlacement ? stand : feature));
  return Object.freeze([...kept, ...stageFeaturesOf(pass)]);
}

function runPassChecks(kind: SpriteKind, pass: SpritePass, folded: readonly SpriteFeature[], where: string): void {
  for (const feature of pass.features) {
    runCheckKind(feature, {base: kind.base, features: folded}, `${where}: feature "${feature.name}" of pass "${pass.name}"`);
  }
}
