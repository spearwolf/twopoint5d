import {uniform, vec3} from 'three/tsl';
import {type Node, Vector2, Vector4} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, stubShaderContext} from '../../testing/spriteGraph.js';
import type {TextureAtlasFrame} from '../../texture/TextureAtlas.js';
import {TextureCoords} from '../../texture/TextureCoords.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {gridBase} from '../GridBase.js';
import {QuadBase} from '../SpriteBase.js';
import {LocalOrder, type SpriteFrameNodes, UvOrder} from '../SpriteFeature.js';
import {AnimatedFrames} from './AnimatedFrames.js';
import {AtlasFrame} from './AtlasFrame.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {NineSlice} from './NineSlice.js';
import {QuadSize} from './QuadSize.js';
import {TextureColor} from './TextureColor.js';

const GRID = gridBase({columns: 3, rows: 3});
const kind = defineSprite({
  base: GRID,
  features: [InstancePosition, FlatPlacement, QuadSize, NineSlice, AtlasFrame, TextureColor],
});
const animatedKind = defineSprite({
  base: GRID,
  features: [InstancePosition, FlatPlacement, QuadSize, NineSlice, AnimatedFrames, TextureColor],
});

const withSprite = <K extends typeof kind | typeof animatedKind>(of: K, test: (sprite: SpriteOf<K>) => void) => {
  const pool = new VertexObjectPool<SpriteOf<K>>(of.description, 1);
  test(pool.createVO()!);
  pool.dispose();
};

type Values = Record<string, number | readonly number[]>;

const nodeOf = (value: number | readonly number[]) => {
  if (typeof value === 'number') return uniform(value);
  return value.length === 2
    ? uniform(new Vector2(value[0], value[1]))
    : uniform(new Vector4(...(value as [number, number, number, number])));
};

// a context whose attributes are uniforms of the values given, the size of the colorMap `textureSize`
const valuedContext = (values: Values, frame: SpriteFrameNodes, textureSize: [number, number] = [24, 24]) => ({
  ...stubShaderContext(frame),
  attribute: <T extends string>(name: string) => nodeOf(values[name]!) as unknown as Node<T>,
  textureSize: () => uniform(new Vector2(...textureSize)) as unknown as Node<'vec2'>,
});

const frameOf = (texCoords: [number, number, number, number], extra?: Partial<Record<'flipDiagonal' | 'mirror', Node>>) =>
  ({texCoords: uniform(new Vector4(...texCoords)) as unknown as Node<'vec4'>, ...extra}) as SpriteFrameNodes;

const WHOLE = frameOf([0, 0, 1, 1]);

/** The x of the vertices on the column lines 0 … 3 of the top row after the local stage, the unit quad moved by `shift`. */
function columnLines(values: Values, frame = WHOLE, shift = 0): number[] {
  return [0, 1, 2, 3].map((i) => {
    const uv = [i / 3, 0];
    const position = vec3(-0.5 + i / 3 + shift, 0.5, 0) as unknown as Node<'vec3'>;
    return (evaluateNode(NineSlice.local!.transform(position, valuedContext({...values, uv}, frame))) as number[])[0]!;
  });
}

/** The y of the vertices on the row lines 0 … 3 of the left column after the local stage. */
function rowLines(values: Values): number[] {
  return [0, 1, 2, 3].map((j) => {
    const position = vec3(-0.5, 0.5 - j / 3, 0.25) as unknown as Node<'vec3'>;
    const moved = evaluateNode(
      NineSlice.local!.transform(position, valuedContext({...values, uv: [0, j / 3]}, WHOLE)),
    ) as number[];
    expect(moved[2]).toBeCloseTo(0.25, 6);
    return moved[1]!;
  });
}

/** The uv of the vertices on the grid line `k` across and down, after the uv stage. */
function uvLines(values: Values, frame = WHOLE, textureSize?: [number, number]): number[][] {
  return [0, 1, 2, 3].map((k) => {
    const uv = uniform(new Vector2(k / 3, k / 3)) as unknown as Node<'vec2'>;
    return evaluateNode(
      NineSlice.uv!.transform(uv, valuedContext({...values, uv: [k / 3, k / 3]}, frame, textureSize)),
    ) as number[];
  });
}

const closeTo = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
};

const sized = (quadSize: [number, number], sliceInsets: [number, number, number, number], sliceScale = 1): Values => ({
  quadSize,
  sliceInsets,
  sliceScale,
});

describe('NineSlice', () => {
  test('declares the static insets and scale, requires QuadSize, and runs in the slice bands', () => {
    expect(NineSlice.name).toBe('nineSlice');
    expect(NineSlice.attributes).toEqual({
      sliceInsets: {components: ['insetLeft', 'insetTop', 'insetRight', 'insetBottom']},
      sliceScale: {size: 1},
    });
    expect(NineSlice.requires).toEqual(['quadSize']);
    expect(NineSlice.local!.order).toBe(LocalOrder.Slice);
    expect(NineSlice.uv!.order).toBe(UvOrder.Slice);
    expect(LocalOrder.Slice).toBeGreaterThan(LocalOrder.Flip);
    expect(LocalOrder.Slice).toBeLessThan(LocalOrder.Scale);
  });

  test('a sprite starts without a border at a scale of 1, whatever its slot held before', () => {
    const pool = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);
    const sprite = pool.createVO()!;
    sprite.setSliceInsets(8, 8, 8, 8);
    sprite.sliceScale = 3;
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.insetLeft, again.insetTop, again.insetRight, again.insetBottom, again.sliceScale]).toEqual([0, 0, 0, 0, 1]);
    pool.dispose();
  });

  describe('checkKind', () => {
    test('refuses a base other than gridBase({columns: 3, rows: 3})', () => {
      for (const base of [QuadBase, gridBase({columns: 4, rows: 3})]) {
        expect(() =>
          defineSprite({base, features: [InstancePosition, FlatPlacement, QuadSize, NineSlice, AtlasFrame, TextureColor]}),
        ).toThrow(
          `defineSprite: feature "nineSlice": needs the base gridBase({columns: 3, rows: 3}), not "${base.name}" — build the kind on it: defineSprite({base: gridBase({columns: 3, rows: 3}), features})`,
        );
      }
    });

    test('refuses a kind without a colorMap', () => {
      expect(() =>
        defineSprite({base: GRID, features: [InstancePosition, FlatPlacement, QuadSize, NineSlice, AtlasFrame]}),
      ).toThrow(
        'defineSprite: feature "nineSlice": measures its frame in texels of the colorMap, which no feature of the kind declares — add TextureColor',
      );
    });
  });

  describe('the local stage', () => {
    test('moves the inner column lines to the border, inset · sliceScale units after QuadSize scales', () => {
      closeTo(columnLines(sized([40, 20], [8, 4, 8, 4])), [-0.5, -0.3, 0.3, 0.5]);
      closeTo(columnLines(sized([40, 20], [8, 4, 8, 4], 2)), [-0.5, -0.1, 0.1, 0.5]);
      closeTo(columnLines(sized([40, 20], [4, 0, 12, 0])), [-0.5, -0.4, 0.2, 0.5]);
    });

    test('moves the inner row lines down from the top', () => {
      closeTo(rowLines(sized([40, 20], [8, 4, 8, 2])), [0.5, 0.3, -0.4, -0.5]);
    });

    test('measures a mirrored sprite by its size, whatever the sign', () => {
      closeTo(columnLines(sized([-40, 20], [8, 4, 8, 4])), [-0.5, -0.3, 0.3, 0.5]);
    });

    test('shrinks borders wider than the sprite in proportion until they meet', () => {
      closeTo(columnLines(sized([8, 8], [8, 0, 8, 0])), [-0.5, 0, 0, 0.5]);
      closeTo(columnLines(sized([4, 8], [6, 0, 2, 0])), [-0.5, 0.25, 0.25, 0.5]);
      // a sprite of no size takes nothing but borders, and no division by 0
      closeTo(columnLines(sized([0, 8], [6, 0, 2, 0])), [-0.5, 0.25, 0.25, 0.5]);
    });

    test('counts an inset below 0 as 0', () => {
      closeTo(columnLines(sized([40, 20], [-8, 0, 8, 0])), [-0.5, -0.5, 0.3, 0.5]);
    });

    test('takes the border of the right for the left under a mirror of the image', () => {
      const mirrored = frameOf([0, 0, 1, 1], {mirror: uniform(new Vector2(1, 0)) as unknown as Node});
      closeTo(columnLines(sized([16, 16], [6, 0, 2, 0]), mirrored), [-0.5, -0.375, 0.125, 0.5]);
      const unmirrored = frameOf([0, 0, 1, 1], {mirror: uniform(new Vector2(0, 1)) as unknown as Node});
      closeTo(columnLines(sized([16, 16], [6, 0, 2, 0]), unmirrored), [-0.5, -0.125, 0.375, 0.5]);
    });

    test('follows a quad an anchor moved before it', () => {
      closeTo(columnLines(sized([40, 20], [8, 4, 8, 4]), WHOLE, 0.5), [0, 0.2, 0.8, 1]);
    });
  });

  describe('the uv stage', () => {
    test('moves the inner lines to the insets in texels of the frame', () => {
      const lines = uvLines(sized([40, 20], [8, 4, 8, 2]));
      closeTo(
        lines.map(([u]) => u!),
        [0, 1 / 3, 2 / 3, 1],
      );
      closeTo(
        lines.map(([, v]) => v!),
        [0, 1 / 6, 1 - 1 / 12, 1],
      );
    });

    test('measures the frame as part of the colorMap', () => {
      // a frame of 12 × 48 texels in a texture of 48 × 96
      const lines = uvLines(sized([40, 20], [4, 8, 4, 8]), frameOf([0.25, 0, 0.25, 0.5]), [48, 96]);
      closeTo(
        lines.map(([u]) => u!),
        [0, 1 / 3, 2 / 3, 1],
      );
      closeTo(
        lines.map(([, v]) => v!),
        [0, 1 / 6, 5 / 6, 1],
      );
    });

    test('measures a turned frame as drawn, its axes swapped', () => {
      // under FLIP_DIAGONAL s and u run along the y of the texture: the frame is drawn 12 × 48
      const turned = frameOf([0, 0.25, 0.25, 0.5], {flipDiagonal: uniform(1) as unknown as Node});
      const lines = uvLines(sized([40, 20], [4, 8, 4, 8]), turned, [96, 48]);
      closeTo(
        lines.map(([u]) => u!),
        [0, 1 / 3, 2 / 3, 1],
      );
      closeTo(
        lines.map(([, v]) => v!),
        [0, 1 / 6, 5 / 6, 1],
      );
      const upright = frameOf([0, 0.25, 0.25, 0.5], {flipDiagonal: uniform(0) as unknown as Node});
      closeTo(
        uvLines(sized([40, 20], [4, 8, 4, 8]), upright, [96, 48]).map(([u]) => u!),
        [0, 1 / 6, 5 / 6, 1],
      );
    });

    test('shrinks insets wider than the frame in proportion, and an unset colorMap as a frame of one texel', () => {
      closeTo(
        uvLines(sized([40, 20], [16, 0, 16, 0])).map(([u]) => u!),
        [0, 0.5, 0.5, 1],
      );
      closeTo(
        uvLines(sized([40, 20], [6, 0, 2, 0]), WHOLE, [0, 0]).map(([u]) => u!),
        [0, 0.75, 0.75, 1],
      );
    });

    test('takes the border of the right for the left under a mirror of the image', () => {
      const mirrored = frameOf([0, 0, 1, 1], {mirror: uniform(new Vector2(1, 1)) as unknown as Node});
      const lines = uvLines(sized([40, 20], [6, 4, 2, 8]), mirrored);
      closeTo(
        lines.map(([u]) => u!),
        [0, 2 / 24, 1 - 6 / 24, 1],
      );
      closeTo(
        lines.map(([, v]) => v!),
        [0, 8 / 24, 1 - 4 / 24, 1],
      );
    });
  });

  describe('setSliceFrame()', () => {
    const sheet = new TextureCoords(0, 0, 128, 128);
    // a UI kit drawn on one canvas: one frame, a slice per panel
    const kit: TextureAtlasFrame<unknown> = {
      coords: new TextureCoords(sheet, 0, 0, 128, 128),
      data: {
        sourceSize: {w: 128, h: 128},
        slices: {
          'panel-stone': {bounds: {x: 0, y: 0, w: 24, h: 24}, center: {x: 8, y: 8, w: 8, h: 8}},
          'button-up': {bounds: {x: 24, y: 32, w: 24, h: 16}, center: {x: 4, y: 4, w: 16, h: 6}},
          pivot: {bounds: {x: 0, y: 0, w: 128, h: 128}, pivot: {x: 64, y: 127}},
        },
      },
    };
    const frameState = (sprite: SpriteOf<typeof kind>) => ({
      texCoords: [sprite.s, sprite.t, sprite.u, sprite.v],
      texFlipDiagonal: sprite.texFlipDiagonal,
      trim: [sprite.trimLeft, sprite.trimTop, sprite.trimRight, sprite.trimBottom],
      insets: [sprite.insetLeft, sprite.insetTop, sprite.insetRight, sprite.insetBottom],
    });

    test('writes a whole untrimmed frame and the insets handed in', () => {
      withSprite(kind, (sprite) => {
        sprite.setTexTrim(0.1, 0.1, 0.1, 0.1);
        sprite.setSliceFrame({coords: new TextureCoords(sheet, 32, 64, 24, 24)}, [8, 7, 6, 5]);

        expect(frameState(sprite)).toEqual({
          texCoords: [0.25, 0.5, 24 / 128, 24 / 128],
          texFlipDiagonal: 0,
          trim: [0, 0, 0, 0],
          insets: [8, 7, 6, 5],
        });
      });
    });

    test('writes the part of the frame a slice covers, and the insets out of its center', () => {
      withSprite(kind, (sprite) => {
        sprite.setSliceFrame(kit, 'button-up');

        expect(frameState(sprite)).toEqual({
          texCoords: [24 / 128, 32 / 128, 24 / 128, 16 / 128],
          texFlipDiagonal: 0,
          trim: [0, 0, 0, 0],
          insets: [4, 4, 4, 6],
        });
      });
    });

    test('takes the one slice of the frame that has a center, without a name', () => {
      const frame: TextureAtlasFrame<unknown> = {
        coords: new TextureCoords(sheet, 0, 0, 24, 24),
        data: {
          sourceSize: {w: 24, h: 24},
          slices: {
            pivot: {bounds: {x: 0, y: 0, w: 24, h: 24}},
            panel: {bounds: {x: 0, y: 0, w: 24, h: 24}, center: {x: 8, y: 8, w: 8, h: 8}},
          },
        },
      };
      withSprite(kind, (sprite) => {
        sprite.setSliceFrame(frame);

        expect(frameState(sprite).insets).toEqual([8, 8, 8, 8]);
        expect(frameState(sprite).texCoords).toEqual([0, 0, 24 / 128, 24 / 128]);
      });
    });

    test('cuts the slice out of a turned frame along the drawn axes', () => {
      // a frame of 32 × 16 packed turned: 16 × 32 in the sheet
      const coords = new TextureCoords(sheet, 64, 0, 16, 32).flipDiagonal();
      const frame: TextureAtlasFrame<unknown> = {
        coords,
        data: {
          sourceSize: {w: 32, h: 16},
          slices: {panel: {bounds: {x: 8, y: 4, w: 16, h: 8}, center: {x: 2, y: 2, w: 12, h: 4}}},
        },
      };
      const [s, t, u, v] = coords.getTexCoords();
      withSprite(kind, (sprite) => {
        sprite.setSliceFrame(frame);

        const state = frameState(sprite);
        expect(state.texFlipDiagonal).toBe(1);
        closeTo(state.texCoords, [s + u / 4, t + v / 4, u / 2, v / 2]);
        expect(state.insets).toEqual([2, 2, 2, 2]);
      });
    });

    test('refuses a trimmed frame', () => {
      const trimmed: TextureAtlasFrame<unknown> = {
        coords: new TextureCoords(sheet, 0, 0, 20, 24),
        data: {trimmed: true, spriteSourceSize: {x: 2, y: 0, w: 20, h: 24}, sourceSize: {w: 24, h: 24}},
      };
      for (const margins of [
        {x: 2, y: 0, w: 20, h: 24},
        {x: 0, y: 2, w: 24, h: 20},
        {x: 0, y: 0, w: 22, h: 24},
        {x: 0, y: 0, w: 24, h: 22},
      ]) {
        withSprite(kind, (sprite) => {
          expect(() =>
            sprite.setSliceFrame({...trimmed, data: {...(trimmed.data as object), spriteSourceSize: margins}}, [8, 8, 8, 8]),
          ).toThrow(
            'setSliceFrame: the frame is trimmed — a nine-slice frame is packed untrimmed, or the packer cuts into its border; export it without trimming (TexturePacker: trim mode None; Aseprite: without --trim)',
          );
          expect(frameState(sprite).insets).toEqual([0, 0, 0, 0]);
        });
      }
    });

    test('refuses a sprite without AtlasFrame', () => {
      withSprite(animatedKind, (sprite) => {
        expect(() => sprite.setSliceFrame(kit, 'panel-stone')).toThrow(
          new TypeError(
            'setSliceFrame: the sprite has no setTexCoords() — setSliceFrame() writes the frame through AtlasFrame; build the kind with AtlasFrame, or set the insets with setSliceInsets()',
          ),
        );
      });
    });

    test('refuses insets that are not four numbers of 0 or more, writing nothing', () => {
      for (const [insets, shown] of [
        [[8, 8, 8], '[8, 8, 8]'],
        [[8, 8, 8, -1], '[8, 8, 8, -1]'],
        [[8, 8, Number.NaN, 8], '[8, 8, NaN, 8]'],
        [8, '8'],
      ] as const) {
        withSprite(kind, (sprite) => {
          expect(() => sprite.setSliceFrame(kit, insets as unknown as [number, number, number, number])).toThrow(
            new RangeError(
              `setSliceFrame: the insets are ${shown} — four numbers of 0 or more, [left, top, right, bottom] in pixels of the frame`,
            ),
          );
          expect(frameState(sprite).texCoords).toEqual([0, 0, 0, 0]);
        });
      }
    });

    test('refuses a slice the frame does not carry, one without a center, and none or several with one', () => {
      withSprite(kind, (sprite) => {
        expect(() => sprite.setSliceFrame(kit, 'pivot')).toThrow(
          `setSliceFrame: the slice "pivot" has no center — turn on 9-Slices in Aseprite's slice properties, or hand the insets in: setSliceFrame(frame, [left, top, right, bottom])`,
        );
        expect(() => sprite.setSliceFrame(kit, 'panel')).toThrow(
          'setSliceFrame: the frame carries no slice "panel" — its slices are: panel-stone, button-up, pivot',
        );
        expect(() => sprite.setSliceFrame(kit)).toThrow(
          'setSliceFrame: the slices "panel-stone", "button-up" of the frame have a center — name one: setSliceFrame(frame, "panel-stone")',
        );
        expect(() => sprite.setSliceFrame({...kit, data: {slices: {pivot: {bounds: {x: 0, y: 0, w: 1, h: 1}}}}})).toThrow(
          `setSliceFrame: no slice of the frame has a center — its slices are: pivot; turn on 9-Slices for one in Aseprite's slice properties, or hand the insets in: setSliceFrame(frame, [left, top, right, bottom])`,
        );
        expect(() => sprite.setSliceFrame({coords: kit.coords})).toThrow(
          'setSliceFrame: the frame carries no slices — read the sheet with AsepriteJson.parse(), exported with its slices (--list-slices), or hand the insets in: setSliceFrame(frame, [left, top, right, bottom])',
        );
        expect(frameState(sprite).texCoords).toEqual([0, 0, 0, 0]);
      });
    });
  });
});
