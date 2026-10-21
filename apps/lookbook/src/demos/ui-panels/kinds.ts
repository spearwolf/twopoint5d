import {
  Anchor,
  AtlasFrame,
  defineSprite,
  FlatPlacement,
  Flash,
  gridBase,
  InstancePosition,
  NineSlice,
  QuadBase,
  QuadSize,
  type SpriteOf,
  TextureColor,
} from '@spearwolf/twopoint5d';

/**
 * Every panel, slot, bar and button of the screen: a frame of the UI kit whose border keeps its
 * size in pixels while `setSize()` stretches the middle. `NineSlice` needs the 3 × 3 grid — the
 * inner grid lines are what it moves — and `Anchor` places a panel by any of its corners.
 */
export const PanelKind = defineSprite({
  base: gridBase({columns: 3, rows: 3}),
  features: [InstancePosition, FlatPlacement, QuadSize, Anchor, NineSlice, AtlasFrame, TextureColor],
});

export type Panel = SpriteOf<typeof PanelKind>;

/**
 * The portraits and the labels out of the `DynamicAtlas`: plain quads placed by their top left
 * corner, and a portrait flashes when its hero takes a hit.
 */
export const PictureKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Anchor, AtlasFrame, TextureColor, Flash],
});

export type Picture = SpriteOf<typeof PictureKind>;
