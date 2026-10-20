import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {TextureAtlasFrame} from '../texture/TextureAtlas.js';
import {TextureCoords} from '../texture/TextureCoords.js';
import {defineSprite} from './defineSprite.js';
import {FeatureSprites} from './FeatureSprites/FeatureSprites.js';
import {Anchor} from './features/Anchor.js';
import {AtlasFrame} from './features/AtlasFrame.js';
import {FlatPlacement} from './features/FlatPlacement.js';
import {Flip} from './features/Flip.js';
import {InstancePosition} from './features/InstancePosition.js';
import {NineSlice} from './features/NineSlice.js';
import {QuadSize} from './features/QuadSize.js';
import {TextureColor} from './features/TextureColor.js';
import {gridBase} from './GridBase.js';
import {QuadBase} from './SpriteBase.js';

// see hot-path-allocations.spec.ts: a call that allocates anything costs 16 B at least
const BYTES_PER_CALL_LIMIT = 1;

const sheet = new TextureCoords(0, 0, 128, 128);

// a fighter of an Aseprite sheet: a trimmed frame of a 64 × 64 canvas and its pivot slice
const fighterFrame: TextureAtlasFrame<unknown> = {
  coords: new TextureCoords(sheet, 0, 0, 30, 50),
  data: {
    trimmed: true,
    spriteSourceSize: {x: 17, y: 14, w: 30, h: 50},
    sourceSize: {w: 64, h: 64},
    slices: Object.freeze({pivot: Object.freeze({bounds: {x: 0, y: 0, w: 64, h: 64}, pivot: {x: 32, y: 63}})}),
  },
};

// a UI kit of one canvas, two panels as slices with a center
const kitFrame: TextureAtlasFrame<unknown> = {
  coords: new TextureCoords(sheet, 0, 0, 128, 128),
  data: {
    sourceSize: {w: 128, h: 128},
    slices: Object.freeze({
      stone: Object.freeze({bounds: {x: 0, y: 0, w: 24, h: 24}, center: {x: 8, y: 8, w: 8, h: 8}}),
      button: Object.freeze({bounds: {x: 24, y: 32, w: 24, h: 16}, center: {x: 4, y: 4, w: 16, h: 8}}),
    }),
  },
};
const panelFrame: TextureAtlasFrame<unknown> = {coords: new TextureCoords(sheet, 48, 0, 24, 24)};
const insets: [number, number, number, number] = [8, 7, 6, 5];

describe('flip, anchor and nine-slice on the hot path', () => {
  test('flipping and anchoring a sprite allocates nothing per call', async () => {
    const kind = defineSprite({
      base: QuadBase,
      features: [InstancePosition, FlatPlacement, QuadSize, Anchor, AtlasFrame, TextureColor, Flip],
    });
    const sprites = new FeatureSprites(kind, {capacity: 1000, attributeUsage: {dynamic: ['flip']}});
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);
    // the tuple a caller keeps for its anchor, written once
    const foot: [number, number] = [0.5, 1];

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.flipX = i & 1;
        sprite.setFlip(i & 1, 0);
        sprite.setAnchor(foot);
        sprite.setAnchorFromPivot(fighterFrame);
        sprite.setAnchorFromPivot(fighterFrame, 'pivot');
      }
      sprites.update();
    });

    expect(bytesPerRound / (all.length * 5)).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });

  test('slicing a panel allocates nothing per call', async () => {
    const kind = defineSprite({
      base: gridBase({columns: 3, rows: 3}),
      features: [InstancePosition, FlatPlacement, QuadSize, NineSlice, AtlasFrame, TextureColor],
    });
    const sprites = new FeatureSprites(kind, {capacity: 1000});
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.setSliceInsets(insets);
        sprite.sliceScale = i;
        sprite.setSliceFrame(panelFrame, insets);
        sprite.setSliceFrame(kitFrame, i & 1 ? 'stone' : 'button');
      }
    });

    expect(bytesPerRound / (all.length * 4)).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });
});
