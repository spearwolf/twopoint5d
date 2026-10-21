import {isSegmentPlacement} from '../features/segmentChecks.js';
import type {SpriteKindShape} from '../SpriteFeature.js';

/**
 * A `checkKind` for the placement of a pass that places the local quad about the instance position:
 * of a segment it would draw the quad of the caps at the start. `does` says what the placement does,
 * `instead` names the pass to take. @internal
 */
export const refuseSegments =
  (does: string, instead: string) =>
  ({features}: SpriteKindShape): void => {
    const segment = features.find(isSegmentPlacement);
    if (segment == null) return;
    throw new Error(
      `it ${does}, and of a segment of "${segment.name}" it would draw the quad of the caps at the start — take ${instead}`,
    );
  };
