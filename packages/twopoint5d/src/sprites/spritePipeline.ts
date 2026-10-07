import type {SpriteFeature} from './SpriteFeature.js';

/**
 * The stages of a sprite kind — or of a pass over one — by slot. The local, mesh and color stages
 * are sorted by their `order`; a tie keeps the order of the feature list.
 *
 * ```
 * frame:    frame slot (or defaults) ─▶ SpriteFrameNodes, read by both pipelines
 * vertex:   base.position ─▶ trim shift ─▶ local ─▶ placement ─▶ mesh ─▶ positionNode
 * fragment: colorSource(frame) ─▶ color ─▶ colorNode
 * ```
 */
export interface SpritePipeline {
  readonly frame: SpriteFeature | undefined;
  readonly local: readonly SpriteFeature[];
  readonly placement: SpriteFeature | undefined;
  readonly mesh: readonly SpriteFeature[];
  readonly colorSource: SpriteFeature | undefined;
  readonly color: readonly SpriteFeature[];
}

type SingleSlot = 'frame' | 'placement' | 'colorSource';
type OrderedSlot = 'local' | 'mesh' | 'color';

const single = (features: readonly SpriteFeature[], slot: SingleSlot, where: string): SpriteFeature | undefined => {
  const holders = features.filter((feature) => feature[slot] != null);
  if (holders.length > 1) {
    const names = holders.map((feature) => `"${feature.name}"`).join(' and ');
    throw new Error(`${where}: features ${names} each contribute a ${slot} stage; a sprite takes at most one`);
  }
  return holders[0];
};

// Array.prototype.sort() is stable, so two stages of one order keep the order of the feature list
const ordered = (features: readonly SpriteFeature[], slot: OrderedSlot): readonly SpriteFeature[] =>
  Object.freeze(features.filter((feature) => feature[slot] != null).sort((a, b) => a[slot]!.order - b[slot]!.order));

/** @internal */
export function buildSpritePipeline(features: readonly SpriteFeature[], where: string): SpritePipeline {
  return Object.freeze({
    frame: single(features, 'frame', where),
    local: ordered(features, 'local'),
    placement: single(features, 'placement', where),
    mesh: ordered(features, 'mesh'),
    colorSource: single(features, 'colorSource', where),
    color: ordered(features, 'color'),
  });
}
