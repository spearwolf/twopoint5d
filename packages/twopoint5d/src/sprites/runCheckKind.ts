import {describeValue} from '../utils/describeValue.js';
import type {SpriteFeature, SpriteKindShape} from './SpriteFeature.js';

/**
 * What a thrown value says: the message of an `Error`, a string as it is, anything else as
 * `describeValue()` shows it. @internal
 */
export const thrownMessage = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : describeValue(error);

/**
 * Runs the `checkKind` of `feature` on `kind`, and throws what it throws as an `Error` in the words
 * of `where`, which names the feature; the error thrown is the `cause`. A thrown `Error` gives its
 * message, a thrown string is the message, any other value stands as `describeValue()` shows it. @internal
 */
export function runCheckKind(feature: SpriteFeature, kind: SpriteKindShape, where: string): void {
  if (feature.checkKind == null) return;
  try {
    feature.checkKind(kind);
  } catch (error) {
    throw new Error(`${where}: ${thrownMessage(error)}`, {cause: error});
  }
}
