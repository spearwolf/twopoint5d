import {uniform, vec3} from 'three/tsl';
import {type Node, Vector2} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, stubShaderContext} from '../../testing/spriteGraph.js';
import type {TextureAtlasFrame} from '../../texture/TextureAtlas.js';
import {TextureCoords} from '../../texture/TextureCoords.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {QuadBase} from '../SpriteBase.js';
import {LocalOrder} from '../SpriteFeature.js';
import {Anchor} from './Anchor.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, Anchor]});
const makePool = () => new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);

const withSprite = (test: (sprite: SpriteOf<typeof kind>) => void) => {
  const pool = makePool();
  test(pool.createVO()!);
  pool.dispose();
};

// the vertex (0.25, -0.5, 0.75) moved by the anchor stage of `anchor`, mirrored by `mirror` if given
const shifted = (anchor: [number, number], mirror?: [number, number]) => {
  const base = stubShaderContext(
    mirror == null
      ? undefined
      : {texCoords: stubShaderContext().frame.texCoords, mirror: uniform(new Vector2(...mirror)) as unknown as Node<'vec2'>},
  );
  const ctx = {...base, attribute: <T extends string>(_name: string) => uniform(new Vector2(...anchor)) as unknown as Node<T>};
  return evaluateNode(Anchor.local!.transform(vec3(0.25, -0.5, 0.75) as unknown as Node<'vec3'>, ctx)) as number[];
};

const closeTo = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
};

/** A frame of an Aseprite sheet: a canvas of `w × h`, the slices given. */
const asepriteFrame = (slices: Record<string, unknown>, w = 64, h = 64): TextureAtlasFrame<unknown> => ({
  coords: new TextureCoords(new TextureCoords(0, 0, 256, 256), 0, 0, w, h),
  data: {sourceSize: {w, h}, slices},
});

const PIVOT = {bounds: {x: 0, y: 0, w: 64, h: 64}, pivot: {x: 32, y: 63}};

describe('Anchor', () => {
  test('declares the static anchor attribute and a local stage in the anchor band', () => {
    expect(Anchor.name).toBe('anchor');
    expect(Anchor.attributes).toEqual({anchor: {components: ['anchorX', 'anchorY']}});
    expect(Anchor.local!.order).toBe(LocalOrder.Anchor);
  });

  test('a sprite starts in the middle, whatever its slot held before', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.setAnchor(0, 1);
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.anchorX, again.anchorY]).toEqual([0.5, 0.5]);
    pool.dispose();
  });

  test('the middle moves nothing', () => {
    closeTo(shifted([0.5, 0.5]), [0.25, -0.5, 0.75]);
  });

  test('moves the unit quad so that the anchor lies on the position', () => {
    // the top left corner: the quad moves right and down by half
    closeTo(shifted([0, 0]), [0.75, -1, 0.75]);
    // the foot: the quad moves up by half
    closeTo(shifted([0.5, 1]), [0.25, 0, 0.75]);
    closeTo(shifted([1, 0.25]), [-0.25, -0.75, 0.75]);
  });

  test('mirrors the anchor with the image', () => {
    closeTo(shifted([0.25, 1], [1, 0]), [0, 0, 0.75]);
    closeTo(shifted([0.25, 1], [0, 1]), [0.5, -1, 0.75]);
    closeTo(shifted([0.25, 1], [0, 0]), [0.5, 0, 0.75]);
  });

  describe('setAnchorFromPivot()', () => {
    test('takes the bottom left corner of the pivot pixel: the fighter of 64 × 64 stands on (0.5, 1)', () => {
      withSprite((sprite) => {
        sprite.setAnchorFromPivot(asepriteFrame({pivot: PIVOT}));

        expect([sprite.anchorX, sprite.anchorY]).toEqual([0.5, 1]);
      });
    });

    test('counts the pivot from the bounds of the slice', () => {
      withSprite((sprite) => {
        sprite.setAnchorFromPivot(asepriteFrame({hand: {bounds: {x: 8, y: 4, w: 8, h: 8}, pivot: {x: 2, y: 3}}}, 32, 16));

        expect([sprite.anchorX, sprite.anchorY]).toEqual([10 / 32, 8 / 16]);
      });
    });

    test('takes the slice named, and without a name the one slice that has a pivot', () => {
      const frame = asepriteFrame({
        hitbox: {bounds: {x: 0, y: 0, w: 64, h: 64}},
        pivot: PIVOT,
        hand: {bounds: {x: 40, y: 20, w: 4, h: 4}, pivot: {x: 0, y: 0}},
      });
      withSprite((sprite) => {
        sprite.setAnchorFromPivot(frame, 'hand');
        expect([sprite.anchorX, sprite.anchorY]).toEqual([40 / 64, 21 / 64]);
      });
      withSprite((sprite) => {
        sprite.setAnchorFromPivot(asepriteFrame({hitbox: {bounds: {x: 0, y: 0, w: 64, h: 64}}, pivot: PIVOT}));
        expect([sprite.anchorX, sprite.anchorY]).toEqual([0.5, 1]);
      });
    });

    test('measures a frame without a sourceSize by its coords, a turned one turned', () => {
      const upright: TextureAtlasFrame<unknown> = {coords: new TextureCoords(0, 0, 32, 16), data: {slices: {pivot: PIVOT}}};
      const turned: TextureAtlasFrame<unknown> = {
        coords: new TextureCoords(0, 0, 32, 16).flipDiagonal(),
        data: {sourceSize: {w: 0, h: 16}, slices: {pivot: PIVOT}},
      };
      withSprite((sprite) => {
        sprite.setAnchorFromPivot(upright);
        expect([sprite.anchorX, sprite.anchorY]).toEqual([1, 4]);
        sprite.setAnchorFromPivot(turned);
        expect([sprite.anchorX, sprite.anchorY]).toEqual([2, 2]);
      });
    });

    test('refuses a frame without slices', () => {
      for (const frame of [{coords: new TextureCoords()}, {coords: new TextureCoords(), data: {frame: {}}}]) {
        withSprite((sprite) => {
          expect(() => sprite.setAnchorFromPivot(frame)).toThrow(
            'setAnchorFromPivot: the frame carries no slices — read the sheet with AsepriteJson.parse(), exported with its slices (--list-slices), or set the anchor with setAnchor(x, y)',
          );
        });
      }
    });

    test('refuses a slice name the frame does not carry, naming those it does', () => {
      withSprite((sprite) => {
        const frame = asepriteFrame({pivot: PIVOT, hitbox: {bounds: PIVOT.bounds}});
        expect(() => sprite.setAnchorFromPivot(frame, 'feet')).toThrow(
          'setAnchorFromPivot: the frame carries no slice "feet" — its slices are: pivot, hitbox',
        );
        expect(() => sprite.setAnchorFromPivot(asepriteFrame({}), 'feet')).toThrow('its slices are: (none)');
        expect([sprite.anchorX, sprite.anchorY]).toEqual([0.5, 0.5]);
      });
    });

    test('refuses a slice without a pivot', () => {
      withSprite((sprite) => {
        expect(() => sprite.setAnchorFromPivot(asepriteFrame({hitbox: {bounds: PIVOT.bounds}}), 'hitbox')).toThrow(
          `setAnchorFromPivot: the slice "hitbox" has no pivot — give it one in Aseprite's slice properties, or set the anchor with setAnchor(x, y)`,
        );
      });
    });

    test('refuses, without a name, a frame with no slice of a pivot and one with several', () => {
      withSprite((sprite) => {
        expect(() => sprite.setAnchorFromPivot(asepriteFrame({hitbox: {bounds: PIVOT.bounds}}))).toThrow(
          `setAnchorFromPivot: no slice of the frame has a pivot — its slices are: hitbox; give one a pivot in Aseprite's slice properties, or set the anchor with setAnchor(x, y)`,
        );
        expect(() => sprite.setAnchorFromPivot(asepriteFrame({pivot: PIVOT, hand: PIVOT, box: {bounds: PIVOT.bounds}}))).toThrow(
          'setAnchorFromPivot: the slices "pivot", "hand" of the frame have a pivot — name one: setAnchorFromPivot(frame, "pivot")',
        );
      });
    });
  });
});
