import type {SpriteKindShape} from '../SpriteFeature.js';

// the names segmentPlacement() gives its forms: `segmentPlacement`, `segmentPlacement+xz`,
// `segmentPlacement+camera`. By name and not by identity: a pass that brings a placement of its own is
// shown the kind's placement as a copy without its placement stage
const SEGMENT_PLACEMENT = /^segmentPlacement(\+|$)/;

// the name of NineSlice, held here rather than imported: NineSlice.ts and SegmentPlacement.ts both
// import this module, and an import of NineSlice.ts would close a cycle between them
const NINE_SLICE = 'nineSlice';

/** Whether `feature` is one of the forms of `segmentPlacement()`, judged by its name. @internal */
export const isSegmentPlacement = (feature: {readonly name: string}): boolean => SEGMENT_PLACEMENT.test(feature.name);

/**
 * Throws for a kind that holds `NineSlice` next to a form of `segmentPlacement()`: a segment lies along
 * its ends, and the local quad, in which `NineSlice` sets its border, holds only the caps. Both the
 * `checkKind` of `NineSlice` and that of the segment placement call it, so that the refusal holds
 * however the two meet — in `defineSprite()`, or when a placement stands in on a live material. @internal
 */
export function refuseNineSliceOnSegments(kind: SpriteKindShape): void {
  if (!kind.features.some(({name}) => name === NINE_SLICE)) return;
  const segment = kind.features.find(isSegmentPlacement);
  if (segment == null) return;
  throw new Error(
    `"${NINE_SLICE}" sets its border in the local quad, and a segment of "${segment.name}" holds only its caps there — the border would land inside the segment. For a bar with fixed ends, lay a nine-slice panel with FlatPlacement, turn it with Rotation and stretch it with setSize(length, thickness), or draw the ends as sprites of their own at the ends of the segment`,
  );
}
