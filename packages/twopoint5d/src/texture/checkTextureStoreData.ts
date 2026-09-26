// The check of the catalog json before `TextureStore#parse()` reads it. What it lets through,
// `parse()` may read without checking again; what it turns away is either the whole catalog —
// a shape no loop over the items can start on — or a single item, which then builds nothing.

import {describeValue} from '../utils/describeValue.js';
import {isTextureOptionClass, type TextureOptionClasses} from './TextureFactory.js';
import type {TextureStoreData} from './types.js';

// an object or an array quoted into a message says nothing as `String()` writes it
const describeCatalogValue = (value: unknown): string =>
  Array.isArray(value) ? 'an array' : typeof value === 'object' && value !== null ? 'an object' : describeValue(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Throws a `TypeError` for data whose shape `parse()` cannot even start on: no object, an
 * `items` that is no object, or a `defaultTextureClasses` that is there and no array. The
 * fields of a single item are left to {@link textureResourceDataProblems}.
 */
export function assertTextureStoreData(data: unknown): asserts data is TextureStoreData {
  if (!isPlainObject(data)) {
    throw new TypeError(
      `[TextureStore] parse() got ${describeCatalogValue(data)} instead of texture store data, an object with an items object`,
    );
  }
  const {items, defaultTextureClasses} = data;
  if (!isPlainObject(items)) {
    throw new TypeError(
      `[TextureStore] parse() got texture store data whose items is ${describeCatalogValue(items)} — items is an object of resource items by id`,
    );
  }
  if (defaultTextureClasses !== undefined && !Array.isArray(defaultTextureClasses)) {
    throw new TypeError(
      `[TextureStore] parse() got texture store data whose defaultTextureClasses is ${describeCatalogValue(defaultTextureClasses)} — defaultTextureClasses is an array of texture class names`,
    );
  }
}

/**
 * What keeps `parse()` from reading this item, one phrase per field of the wrong type; empty
 * when it can read it. Absent is `undefined`: a `null` in an optional field is a field of the
 * wrong type.
 *
 * The values inside `tileSet` are checked by `TileSet`, the entries of `frameBasedAnimations`
 * by the animation effects of the resource — both report what they refuse.
 */
export const textureResourceDataProblems = (item: unknown): string[] => {
  if (!isPlainObject(item)) return [`it is ${describeCatalogValue(item)}, not an object`];

  const problems: string[] = [];
  for (const key of ['imageUrl', 'atlasUrl', 'overrideImageUrl'] as const) {
    const value = item[key];
    if (value !== undefined && typeof value !== 'string') {
      problems.push(`${key} is ${describeCatalogValue(value)}, not a string`);
    }
  }
  const {tileSet, texture, frameBasedAnimations} = item;
  if (tileSet !== undefined && !isPlainObject(tileSet)) {
    problems.push(`tileSet is ${describeCatalogValue(tileSet)}, not an object`);
  }
  if (texture !== undefined && !Array.isArray(texture)) {
    problems.push(`texture is ${describeCatalogValue(texture)}, not an array`);
  }
  if (frameBasedAnimations !== undefined && !isPlainObject(frameBasedAnimations)) {
    problems.push(`frameBasedAnimations is ${describeCatalogValue(frameBasedAnimations)}, not an object`);
  }
  return problems;
};

/**
 * The names a `TextureFactory` knows and the rest, each in the order they were given.
 */
export const partitionTextureClasses = (names: readonly unknown[]): {known: TextureOptionClasses[]; unknown: unknown[]} => {
  const known: TextureOptionClasses[] = [];
  const unknown: unknown[] = [];
  for (const name of names) {
    if (isTextureOptionClass(name)) {
      known.push(name);
    } else {
      unknown.push(name);
    }
  }
  return {known, unknown};
};

/** Values out of the catalog as a message lists them: `"nearset", 5`. */
export const listCatalogValues = (values: readonly unknown[]): string => values.map(describeCatalogValue).join(', ');
