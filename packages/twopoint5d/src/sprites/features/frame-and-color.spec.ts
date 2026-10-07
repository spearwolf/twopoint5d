import {vec4} from 'three/tsl';
import type {Node, VaryingNode} from 'three/webgpu';
import {Color} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {attributeNamesOf, operatorOf, stubShaderContext, textureNodesOf} from '../../testing/spriteGraph.js';
import type {TextureAtlasFrame} from '../../texture/TextureAtlas.js';
import {TextureCoords} from '../../texture/TextureCoords.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {QuadBase} from '../SpriteBase.js';
import {ColorOrder} from '../SpriteFeature.js';
import {AtlasFrame, prepareSpriteFrame} from './AtlasFrame.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {TextureColor} from './TextureColor.js';
import {Tint} from './Tint.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, AtlasFrame, TextureColor, Tint]});
const makePool = (capacity = 1) => new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, capacity);

// s, t, u, v of the coords come out as 0.25, 0.5, 0.75, 1
const frame: TextureAtlasFrame = {coords: new TextureCoords(new TextureCoords(0, 0, 4, 2), 1, 1, 3, 2)};

// TexturePacker data of a sprite of 5 × 4 trimmed to 2 × 1 at (1, 2): margins 1/5, 2/4, 2/5, 1/4
const trimmedFrame: TextureAtlasFrame<unknown> = {
  coords: new TextureCoords(new TextureCoords(0, 0, 8, 4), 5, 0, 2, 1),
  data: {trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}},
};

const flippedFrame: TextureAtlasFrame = {coords: new TextureCoords(new TextureCoords(0, 0, 4, 2), 1, 1, 3, 2)};
flippedFrame.coords.flip = TextureCoords.FLIP_DIAGONAL;

describe('AtlasFrame', () => {
  test('declares the frame attributes and lets texCoords carry the usage of all three', () => {
    expect(Object.keys(AtlasFrame.attributes!)).toEqual(['texCoords', 'texFlipDiagonal', 'texTrim']);
    expect(AtlasFrame.usageAliases).toEqual({texCoords: ['texFlipDiagonal', 'texTrim']});
  });

  test('setFrame() writes the tex coords, 0 for the flip and four zero margins for an upright untrimmed frame', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;

    sprite.setFrame(frame);

    expect([sprite.s, sprite.t, sprite.u, sprite.v]).toEqual([0.25, 0.5, 0.75, 1]);
    expect(sprite.texFlipDiagonal).toBe(0);
    expect([sprite.trimLeft, sprite.trimTop, sprite.trimRight, sprite.trimBottom]).toEqual([0, 0, 0, 0]);
    pool.dispose();
  });

  test('setFrame() writes 1 for a frame with FLIP_DIAGONAL and 0 again for an upright one after it', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;

    sprite.setFrame(flippedFrame);
    expect(sprite.texFlipDiagonal).toBe(1);
    sprite.setFrame(frame);
    expect(sprite.texFlipDiagonal).toBe(0);
    pool.dispose();
  });

  test('setFrame() writes the margins of a trimmed frame and four zeros for an untrimmed one after it', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;

    sprite.setFrame(trimmedFrame);
    expect([sprite.trimLeft, sprite.trimTop, sprite.trimRight, sprite.trimBottom]).toEqual([
      Math.fround(0.2),
      0.5,
      Math.fround(0.4),
      0.25,
    ]);
    sprite.setFrame(frame);
    expect([sprite.trimLeft, sprite.trimTop, sprite.trimRight, sprite.trimBottom]).toEqual([0, 0, 0, 0]);
    pool.dispose();
  });

  test('setPreparedFrame() writes what setFrame() writes for the frame as it was prepared', () => {
    const pool = makePool(2);
    const a = pool.createVO()!;
    const b = pool.createVO()!;

    a.setFrame(trimmedFrame);
    b.setPreparedFrame(prepareSpriteFrame(trimmedFrame));

    expect([b.s, b.t, b.u, b.v, b.texFlipDiagonal, b.trimLeft, b.trimTop, b.trimRight, b.trimBottom]).toEqual([
      a.s,
      a.t,
      a.u,
      a.v,
      a.texFlipDiagonal,
      a.trimLeft,
      a.trimTop,
      a.trimRight,
      a.trimBottom,
    ]);
    pool.dispose();
  });

  test('prepareSpriteFrame() takes a snapshot of the frame', () => {
    const coords = new TextureCoords(new TextureCoords(0, 0, 4, 2), 1, 1, 3, 2);
    const prepared = prepareSpriteFrame({coords});

    coords.flip = TextureCoords.FLIP_DIAGONAL;

    expect(prepared.texFlipDiagonal).toBe(0);
  });

  test('takes a frame of an atlas whose frame data is of its own kind, with no trim', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;

    sprite.setFrame({coords: frame.coords, data: {name: 'mine'}});

    expect([sprite.trimLeft, sprite.trimTop, sprite.trimRight, sprite.trimBottom]).toEqual([0, 0, 0, 0]);
    expect(prepareSpriteFrame({coords: frame.coords, data: 42}).texTrim).toEqual([0, 0, 0, 0]);
    pool.dispose();
  });

  test('a sprite starts with its frame values at 0, whatever its slot held before', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.setFrame(flippedFrame);
    sprite.setFrame(trimmedFrame);
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([
      again.s,
      again.t,
      again.u,
      again.v,
      again.texFlipDiagonal,
      again.trimLeft,
      again.trimTop,
      again.trimRight,
      again.trimBottom,
    ]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    pool.dispose();
  });

  test('its frame stage answers the three frame attributes', () => {
    const nodes = AtlasFrame.frame!(stubShaderContext());

    expect(attributeNamesOf(nodes.texCoords)).toEqual(['texCoords']);
    expect(attributeNamesOf(nodes.flipDiagonal!)).toEqual(['texFlipDiagonal']);
    expect(attributeNamesOf(nodes.trim!)).toEqual(['texTrim']);
  });
});

describe('TextureColor', () => {
  test('declares the colorMap texture, which it does not wait for an image of', () => {
    expect(TextureColor.textures).toEqual({colorMap: {}});
  });

  test('samples the colorMap through a varying at the frame', () => {
    const ctx = stubShaderContext({texCoords: vec4(0, 0, 1, 1) as unknown as Node<'vec4'>});

    const color = TextureColor.colorSource!(ctx.frame, ctx);
    const [sample] = textureNodesOf(color);

    expect(ctx.sampled).toEqual([{name: 'colorMap'}]);
    expect((sample!.uvNode as unknown as VaryingNode<unknown>).isVaryingNode).toBe(true);
    expect(attributeNamesOf(color)).toEqual(['uv']);
  });

  test('reads the flip of the frame inside the varying', () => {
    const ctx = stubShaderContext(AtlasFrame.frame!(stubShaderContext()));

    const color = TextureColor.colorSource!(ctx.frame, ctx);

    expect(attributeNamesOf(color)).toContain('texFlipDiagonal');
    expect(attributeNamesOf(color)).toContain('texCoords');
  });
});

describe('Tint', () => {
  test('declares the color attribute with setColorValues as its setter and no getter, in the tint band', () => {
    expect(Tint.attributes).toEqual({color: {components: ['r', 'g', 'b', 'a'], setter: 'setColorValues', getter: false}});
    expect(Tint.color!.order).toBe(ColorOrder.Tint);
  });

  test('a sprite starts white, whatever its slot held before', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.setColorValues(0, 0, 0, 0);
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.r, again.g, again.b, again.a]).toEqual([1, 1, 1, 1]);
    pool.dispose();
  });

  test('setColor(color, a) writes rgb and alpha; setColor(color) keeps the alpha', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;

    sprite.setColor(new Color(0.5, 0.25, 0.125), 0.5);
    expect([sprite.r, sprite.g, sprite.b, sprite.a]).toEqual([0.5, 0.25, 0.125, 0.5]);
    sprite.setColor(new Color(0.75, 0.5, 0.25));
    expect([sprite.r, sprite.g, sprite.b, sprite.a]).toEqual([0.75, 0.5, 0.25, 0.5]);
    pool.dispose();
  });

  test('setColor() hands its values on in one array', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    const setColorValues = vi.spyOn(sprite, 'setColorValues');

    sprite.setColor(new Color(0.5, 0.25, 0.125), 0.5);
    expect(setColorValues.mock.calls).toEqual([[[0.5, 0.25, 0.125, 0.5]]]);
    setColorValues.mockClear();
    sprite.setColor(new Color(0.75, 0.5, 0.25));
    expect(setColorValues.mock.calls).toEqual([[[0.75, 0.5, 0.25]]]);
    pool.dispose();
  });

  test('getColor() answers the rgb in a new Color, or in the target it is given', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.setColorValues(0.5, 0.25, 0.125, 1);
    const target = new Color();

    expect(sprite.getColor().toArray()).toEqual([0.5, 0.25, 0.125]);
    expect(sprite.getColor(target)).toBe(target);
    expect(target.toArray()).toEqual([0.5, 0.25, 0.125]);
    pool.dispose();
  });

  test('its color stage multiplies the color by the color attribute', () => {
    const input = vec4(1, 1, 1, 1) as unknown as Node<'vec4'>;

    const tinted = operatorOf(Tint.color!.transform(input, stubShaderContext()));

    expect(tinted.op).toBe('*');
    expect(tinted.aNode).toBe(input);
    expect(attributeNamesOf(tinted.bNode as Node)).toEqual(['color']);
  });
});
