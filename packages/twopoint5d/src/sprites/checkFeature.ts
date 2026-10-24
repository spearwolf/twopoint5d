import {describeValue} from '../utils/describeValue.js';
import {isObject} from '../utils/isObject.js';
import type {SpriteFeature} from './SpriteFeature.js';

const STAGE_SLOTS = ['frameStage', 'local', 'mesh', 'uv', 'color'] as const;
const FUNCTION_SLOTS = ['frame', 'placement', 'colorSource'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => isObject(value) && !Array.isArray(value);

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/**
 * Checks a feature on its own, in the words of `where`: that it is an object with a name, and
 * every field it brings for its type. `defineFeature()` runs it, and so does every place that takes
 * a feature — `defineSprite()`, `definePass()`, `new SpriteResources()` and the placement swap —,
 * since a plain object passes for one. What can only be checked against the other features of a
 * kind, `defineSprite()` checks. @internal
 *
 * @throws a `TypeError` naming the feature and the field
 */
export function checkFeature(feature: unknown, where: string): asserts feature is SpriteFeature {
  if (!isRecord(feature)) {
    throw new TypeError(`${where}: a feature is an object with a name, got ${describeValue(feature)}`);
  }
  const {name} = feature;
  if (typeof name !== 'string' || name === '') throw new TypeError(`${where}: a feature needs a name`);
  // a field of null or undefined is a field the feature does not bring
  const {attributes, usageAliases, methods, initialize, uniforms, textures, nearestTextures, requires, checkKind} = feature;

  if (attributes != null) {
    if (!isRecord(attributes)) {
      throw new TypeError(
        `${where}: the attributes of feature "${name}" are no record of attribute descriptions, got ${describeValue(attributes)}`,
      );
    }
    for (const [key, value] of Object.entries(attributes)) {
      if (!isRecord(value)) {
        throw new TypeError(
          `${where}: the attribute "${key}" of feature "${name}" is no attribute description, got ${describeValue(value)}`,
        );
      }
    }
  }
  if (usageAliases != null) {
    if (!isRecord(usageAliases)) {
      throw new TypeError(
        `${where}: the usageAliases of feature "${name}" are no record of attribute name lists, got ${describeValue(usageAliases)}`,
      );
    }
    for (const [word, value] of Object.entries(usageAliases)) {
      if (!isStringList(value)) {
        throw new TypeError(
          `${where}: the usage alias "${word}" of feature "${name}" is no list of attribute names, got ${describeValue(value)}`,
        );
      }
    }
  }
  if (methods != null) {
    if (!isRecord(methods)) {
      throw new TypeError(`${where}: the methods of feature "${name}" are no record of functions, got ${describeValue(methods)}`);
    }
    for (const [key, value] of Object.entries(methods)) {
      if (typeof value !== 'function') throw new TypeError(`${where}: the method "${key}" of feature "${name}" is no function`);
    }
  }
  if (initialize != null && typeof initialize !== 'function') {
    throw new TypeError(`${where}: the initialize of feature "${name}" is no function`);
  }
  // the declarations in it are checked by collectSpriteDeclarations(), against those of the other features
  if (uniforms != null && !isRecord(uniforms)) {
    throw new TypeError(
      `${where}: the uniforms of feature "${name}" are no record of uniform declarations, got ${describeValue(uniforms)}`,
    );
  }
  if (textures != null) {
    if (!isRecord(textures)) {
      throw new TypeError(
        `${where}: the textures of feature "${name}" are no record of texture declarations, got ${describeValue(textures)}`,
      );
    }
    for (const [key, value] of Object.entries(textures)) {
      if (!isRecord(value) || (value['needsImage'] !== undefined && typeof value['needsImage'] !== 'boolean')) {
        throw new TypeError(
          `${where}: the texture "${key}" of feature "${name}" is declared with ${describeValue(value)}; a texture takes {} or {needsImage: true}`,
        );
      }
    }
  }
  if (nearestTextures != null && !isStringList(nearestTextures)) {
    throw new TypeError(`${where}: the nearestTextures of feature "${name}" is no list of texture names`);
  }
  for (const slot of FUNCTION_SLOTS) {
    const value = feature[slot];
    if (value != null && typeof value !== 'function') {
      throw new TypeError(`${where}: the ${slot} of feature "${name}" is no function`);
    }
  }
  for (const slot of STAGE_SLOTS) {
    const stage = feature[slot];
    if (stage == null) continue;
    if (!isRecord(stage)) {
      throw new TypeError(
        `${where}: the ${slot} stage of feature "${name}" is no {order, transform}, got ${describeValue(stage)}`,
      );
    }
    if (!Number.isFinite(stage['order'])) {
      throw new TypeError(
        `${where}: the ${slot} stage of feature "${name}" needs a finite order, got ${describeValue(stage['order'])}`,
      );
    }
    if (typeof stage['transform'] !== 'function') {
      throw new TypeError(`${where}: the ${slot} stage of feature "${name}" needs a transform function`);
    }
  }
  if (requires != null) {
    if (!isStringList(requires)) throw new TypeError(`${where}: the requires of feature "${name}" is no list of feature names`);
    if (requires.includes(name)) throw new TypeError(`${where}: feature "${name}" requires itself`);
  }
  if (checkKind != null && typeof checkKind !== 'function') {
    throw new TypeError(`${where}: the checkKind of feature "${name}" is no function`);
  }
}
