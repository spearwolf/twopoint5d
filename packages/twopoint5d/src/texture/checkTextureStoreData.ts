// The check of the catalog json before `TextureStore#parse()` reads it. What it lets through,
// `parse()` may read without checking again; what it turns away is either the whole catalog —
// a shape no loop over the items can start on — or a single item, which then builds nothing.

import {describeValue} from '../utils/describeValue.js';
import {isObject} from '../utils/isObject.js';
import {isAnimationPlayback} from './animationPlayback.js';
import {isTextureOptionClass, type TextureOptionClasses} from './TextureFactory.js';
import type {TextureStoreData} from './types.js';

// a catalog, or a part of it, is large, and what a message about its shape has to name is its kind — an array
// or an object —, not its content
const describeCatalogValue = (value: unknown): string =>
  Array.isArray(value) ? 'an array' : isObject(value) ? 'an object' : describeValue(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> => isObject(value) && !Array.isArray(value);

/**
 * Throws a `TypeError` for data whose shape `parse()` cannot even start on: no object, an
 * `items` that is no object, or a `defaultTextureClasses` that is there and no array. The
 * fields of a single item are left to {@link textureResourceDataProblems}.
 */
export function assertTextureStoreData(data: unknown): asserts data is TextureStoreData {
  if (!isPlainObject(data)) {
    throw new TypeError(
      `TextureStore: parse() got ${describeCatalogValue(data)} instead of texture store data, an object with an items object`,
    );
  }
  const {items, defaultTextureClasses} = data;
  if (!isPlainObject(items)) {
    throw new TypeError(
      `TextureStore: parse() got texture store data whose items is ${describeCatalogValue(items)} — items is an object of resource items by id`,
    );
  }
  if (defaultTextureClasses !== undefined && !Array.isArray(defaultTextureClasses)) {
    throw new TypeError(
      `TextureStore: parse() got texture store data whose defaultTextureClasses is ${describeCatalogValue(defaultTextureClasses)} — defaultTextureClasses is an array of texture class names`,
    );
  }
}

/**
 * What keeps `parse()` from reading this item, one phrase per field of the wrong type; empty
 * when it can read it. Absent is `undefined`: a `null` in an optional field is a field of the
 * wrong type.
 *
 * The values of `playback` are checked here, each a playback of `FrameBasedAnimations`; whether its
 * names are tags of the sheet is the adapter's to say. The values inside `tileSet` are checked by
 * `TileSet`, the entries of `frameBasedAnimations` by the animation effects of the resource — both
 * report what they refuse.
 */
export const textureResourceDataProblems = (item: unknown): string[] => {
  if (!isPlainObject(item)) return [`it is ${describeCatalogValue(item)}, not an object`];

  const problems: string[] = [];
  for (const key of ['imageUrl', 'atlasUrl', 'overrideImageUrl', 'atlasAdapter'] as const) {
    const value = item[key];
    if (value !== undefined && typeof value !== 'string') {
      problems.push(`${key} is ${describeCatalogValue(value)}, not a string`);
    }
  }
  const {tileSet, texture, frameBasedAnimations, playback} = item;
  if (tileSet !== undefined && !isPlainObject(tileSet)) {
    problems.push(`tileSet is ${describeCatalogValue(tileSet)}, not an object`);
  }
  if (texture !== undefined && !Array.isArray(texture)) {
    problems.push(`texture is ${describeCatalogValue(texture)}, not an array`);
  }
  if (frameBasedAnimations !== undefined && !isPlainObject(frameBasedAnimations)) {
    problems.push(`frameBasedAnimations is ${describeCatalogValue(frameBasedAnimations)}, not an object`);
  }
  if (playback !== undefined) {
    if (!isPlainObject(playback)) {
      problems.push(`playback is ${describeCatalogValue(playback)}, not an object`);
    } else {
      for (const [name, value] of Object.entries(playback)) {
        if (!isAnimationPlayback(value)) {
          problems.push(`the playback of "${name}" is ${describeValue(value)}, not 'loop', 'once' or 'pingpong'`);
        }
      }
    }
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
