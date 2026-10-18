import {attribute, int, uv, vec2} from 'three/tsl';
import {
  ConditionalNode,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  type Node,
  Texture,
  type TextureNode,
} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {nodesOf, operatorOf, textureNodesOf} from '../testing/spriteGraph.js';
import {AtlasFrameTable} from './AtlasFrameTable.js';
import {type SampleAtlasFrameOptions, sampleAtlasFrame} from './sampleAtlasFrame.js';
import {TextureCoords} from './TextureCoords.js';

const table = new AtlasFrameTable([new TextureCoords(new TextureCoords(0, 0, 8, 4), 2, 0, 4, 2)]);

const ORIGINS = ['top-left', 'bottom-left'] as const;
const WRAPS = ['clamp', 'repeat', ['repeat', 'clamp'], undefined] as const;
const TRIMS = ['mask', 'stretch', undefined] as const;
const INDICES: [string, () => Node<'int'> | Node<'uint'> | Node<'float'> | number][] = [
  ['a number', () => 0],
  ['an int node', () => int(0)],
  ['a float attribute', () => attribute<'float'>('frame')],
];

describe('sampleAtlasFrame()', () => {
  for (const origin of ORIGINS) {
    for (const wrap of WRAPS) {
      for (const trim of TRIMS) {
        test(`builds a graph for origin ${origin}, wrap ${wrap ?? 'by default'}, trim ${trim ?? 'by default'}`, () => {
          const map = new Texture();
          const color = sampleAtlasFrame(map, table, 0, uv(), {origin, wrap, trim, inset: 0.5});

          expect(textureNodesOf(color).some((node) => node.value === map)).toBe(true);
          expect(nodesOf(color).has(table.node as unknown as Node)).toBe(true);
        });
      }
    }
  }

  for (const [name, index] of INDICES) {
    test(`takes ${name} as the index`, () => {
      const color = sampleAtlasFrame(new Texture(), table, index(), vec2(0.5, 0.5), {origin: 'top-left'});

      expect(nodesOf(color).has(table.node as unknown as Node)).toBe(true);
    });
  }

  test('samples a mipmapped texture with explicit gradients, so a wrap does not drop to the smallest mip level', () => {
    const map = new Texture();
    const color = sampleAtlasFrame(map, table, 0, uv(), {origin: 'bottom-left', wrap: 'repeat'});
    const [sample] = textureNodesOf(color).filter((node) => node.value === map) as TextureNode[];

    expect(map.minFilter).toBe(LinearMipmapLinearFilter);
    expect(sample!.gradNode).not.toBeNull();
  });

  test('takes no gradients for a minFilter that reads no mipmaps', () => {
    for (const minFilter of [NearestFilter, LinearFilter]) {
      const map = new Texture();
      map.minFilter = minFilter;
      map.magFilter = NearestFilter;
      const color = sampleAtlasFrame(map, table, 0, uv(), {origin: 'bottom-left', wrap: 'repeat'});
      const [sample] = textureNodesOf(color).filter((node) => node.value === map) as TextureNode[];

      expect(sample!.gradNode, `minFilter ${minFilter}`).toBeNull();
    }
  });

  test("with trim 'mask' the color is multiplied by the inside of the trimmed area, with 'stretch' it is the sample", () => {
    const map = new Texture();
    const masked = sampleAtlasFrame(map, table, 0, uv(), {origin: 'top-left', trim: 'mask'});
    const stretched = sampleAtlasFrame(map, table, 0, uv(), {origin: 'top-left', trim: 'stretch'});

    expect(operatorOf(masked).op).toBe('*');
    expect((stretched as unknown as TextureNode).isTextureNode).toBe(true);
  });

  test('refuses an origin, a wrap and a trim it does not know', () => {
    const map = new Texture();
    const call = (options: unknown) => () => sampleAtlasFrame(map, table, 0, uv(), options as SampleAtlasFrameOptions);

    expect(call({})).toThrow(/origin/);
    expect(call({origin: 'center'})).toThrow(/origin/);
    expect(call({origin: 'top-left', wrap: 'mirror'})).toThrow(/wrap/);
    expect(call({origin: 'top-left', wrap: ['repeat']})).toThrow(/wrap/);
    expect(call({origin: 'top-left', wrap: ['repeat', 'mirror']})).toThrow(/wrap/);
    expect(call({origin: 'top-left', wrap: ['repeat', 'clamp', 'clamp']})).toThrow(/wrap/);
    expect(call({origin: 'top-left', wrap: 1})).toThrow(/wrap/);
    expect(call({origin: 'top-left', trim: 'crop'})).toThrow(/trim/);
  });

  test('a wrap of one word is the wrap of both axes', () => {
    const map = new Texture();
    map.minFilter = NearestFilter;
    const one = sampleAtlasFrame(map, table, 0, uv(), {origin: 'top-left', wrap: 'repeat', trim: 'stretch'});
    const both = sampleAtlasFrame(map, table, 0, uv(), {origin: 'top-left', wrap: ['repeat', 'repeat'], trim: 'stretch'});
    const mathOf = (root: Node) =>
      [...nodesOf(root)].map((node) => (node as unknown as {method?: string}).method).filter((method) => method != null);

    expect(mathOf(both).filter((method) => method === 'fract').length).toBeGreaterThan(0);
    expect(mathOf(one).filter((method) => method === 'clamp').length).toBe(
      mathOf(both).filter((method) => method === 'clamp').length,
    );
  });

  test('builds no branch: three declares a value read in both branches of a select() in only one of them', () => {
    const map = new Texture();
    const color = sampleAtlasFrame(map, table, attribute<'float'>('frame'), uv(), {
      origin: 'bottom-left',
      wrap: 'repeat',
      inset: 0.5,
    });

    expect([...nodesOf(color)].filter((node) => node instanceof ConditionalNode)).toEqual([]);
  });

  test('refuses an inset that is negative or no finite number', () => {
    const map = new Texture();
    const call = (inset: number) => () => sampleAtlasFrame(map, table, 0, uv(), {origin: 'top-left', inset});

    expect(call(-1)).toThrow(RangeError);
    expect(call(Number.NaN)).toThrow(RangeError);
    expect(call(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(call(0)).not.toThrow();
  });
});
