import type {SpriteFeature, SpriteKindShape} from './SpriteFeature.js';

/**
 * Runs the `checkKind` of `feature` on `kind`, and throws what it throws as an `Error` in the words
 * of `where`, which names the feature; the error thrown is the `cause`. @internal
 */
export function runCheckKind(feature: SpriteFeature, kind: SpriteKindShape, where: string): void {
  if (feature.checkKind == null) return;
  try {
    feature.checkKind(kind);
  } catch (error) {
    throw new Error(`${where}: ${error instanceof Error ? error.message : String(error)}`, {cause: error});
  }
}
