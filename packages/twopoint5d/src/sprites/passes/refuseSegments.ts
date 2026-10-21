import type {SpriteKindShape} from '../SpriteFeature.js';

// the names segmentPlacement() gives its forms: `segmentPlacement`, `segmentPlacement+xz`,
// `segmentPlacement+camera`. By name and not by identity: a pass that brings a placement of its own is
// shown the kind's placement as a copy without its placement stage
const SEGMENT_PLACEMENT = /^segmentPlacement(\+|$)/;

/**
 * A `checkKind` for the placement of a pass that places the local quad about the instance position:
 * of a segment it would draw the quad of the caps at the start. `does` says what the placement does,
 * `instead` names the pass to take. @internal
 */
export const refuseSegments =
  (does: string, instead: string) =>
  ({features}: SpriteKindShape): void => {
    const segment = features.find(({name}) => SEGMENT_PLACEMENT.test(name));
    if (segment == null) return;
    throw new Error(
      `it ${does}, and of a segment of "${segment.name}" it would draw the quad of the caps at the start — take ${instead}`,
    );
  };
