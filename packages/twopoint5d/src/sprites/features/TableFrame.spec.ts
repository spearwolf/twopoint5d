import {cameraPosition, uniform, vec2, vec4} from 'three/tsl';
import {type Node, Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {
  attributeNamesOf,
  evaluateNode,
  nodesOf,
  samplesTexture,
  stubShaderContext,
  textureNodesOf,
} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {FeatureSpritesMaterial} from '../FeatureSprites/FeatureSpritesMaterial.js';
import {QuadBase} from '../SpriteBase.js';
import {AxisBillboardPlacement} from './AxisBillboardPlacement.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {QuadSize} from './QuadSize.js';
import {TableFrame, tableFrame} from './TableFrame.js';
import {TextureColor} from './TextureColor.js';
import {Yaw} from './Yaw.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TableFrame, TextureColor]});
const viewKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, AxisBillboardPlacement, QuadSize, Yaw, tableFrame({views: 8}), TextureColor],
});

const makeTable = (width = 16, height = 1) => {
  const texture = new Texture();
  texture.image = {width, height} as unknown as HTMLImageElement;
  return texture;
};

describe('tableFrame()', () => {
  test('answers one frozen feature per set of options', () => {
    expect(tableFrame()).toBe(TableFrame);
    expect(tableFrame({})).toBe(TableFrame);
    expect(tableFrame({views: 8})).toBe(tableFrame({views: 8}));
    expect(tableFrame({views: 4})).not.toBe(tableFrame({views: 8}));
    expect(Object.isFrozen(TableFrame)).toBe(true);
  });

  test('is named by its views, and requires the position and the yaw with views', () => {
    expect(TableFrame.name).toBe('tableFrame');
    expect(TableFrame.requires).toBeUndefined();
    expect(tableFrame({views: 8}).name).toBe('tableFrame+views8');
    expect(tableFrame({views: 8}).requires).toEqual(['instancePosition', 'yaw']);
  });

  test('declares frameIndex and the frameTable it waits for an image of', () => {
    for (const feature of [TableFrame, tableFrame({views: 8})]) {
      expect(feature.attributes).toEqual({frameIndex: {size: 1}});
      expect(feature.textures).toEqual({frameTable: {needsImage: true}});
    }
  });

  test.each([
    [1, '1'],
    [0, '0'],
    [2.5, '2.5'],
    [-8, '-8'],
    ['8', '"8"'],
    [Number.NaN, 'NaN'],
    [Infinity, 'Infinity'],
    [65, '65'],
  ])('refuses views of %o', (views, shown) => {
    expect(() => tableFrame({views: views as number})).toThrow(
      new TypeError(
        `tableFrame: views must be a whole number from 2 to 64, got ${shown} — leave views out for frames without views`,
      ),
    );
  });

  test.each([
    [5, '5'],
    ['x', '"x"'],
    [null, 'null'],
  ])('refuses options of %o that are no object', (options, shown) => {
    expect(() => tableFrame(options as never)).toThrow(
      new TypeError(`tableFrame: the options must be an object, {views?}, got ${shown}`),
    );
  });

  test('takes options that are undefined', () => {
    expect(() => tableFrame(undefined)).not.toThrow();
  });

  test('takes views up to 64', () => {
    expect(tableFrame({views: 64}).name).toBe('tableFrame+views64');
  });

  test('a sprite starts at frame index 0, whatever its slot held before', () => {
    const pool = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);
    const sprite = pool.createVO()!;
    sprite.frameIndex = 7;
    pool.freeVO(sprite);
    expect(pool.createVO()!.frameIndex).toBe(0);
    pool.dispose();
  });

  test('a kind with views and without Yaw is refused', () => {
    expect(() =>
      defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, tableFrame({views: 8}), TextureColor]}),
    ).toThrow('defineSprite: feature "tableFrame+views8" requires feature "yaw", which this sprite kind does not hold');
  });

  test('draws the whole colorMap while there is no frame table, or one without an image', () => {
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture()}});
    expect(attributeNamesOf(material.colorNode!)).not.toContain('frameIndex');
    material.setTexture('frameTable', new Texture());
    expect(attributeNamesOf(material.colorNode!)).not.toContain('frameIndex');
    material.dispose();
  });

  test('reads the frame out of the table by frameIndex in both graphs: header, coords, flip and trim', () => {
    const table = makeTable();
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), frameTable: table}});

    expect(samplesTexture(material.positionNode!, table)).toBe(true);
    expect(samplesTexture(material.colorNode!, table)).toBe(true);
    expect(attributeNamesOf(material.colorNode!)).toContain('frameIndex');
    expect(attributeNamesOf(material.positionNode!)).not.toContain('yaw');
    const lookups = new Set(
      [...textureNodesOf(material.positionNode!), ...textureNodesOf(material.colorNode!)].filter((node) => node.value === table),
    );
    expect(lookups.size).toBe(4);
    material.dispose();
  });

  test('a frame table of the same kind takes the place of the one set without a rebuild', () => {
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), frameTable: makeTable(16, 1)}});
    const {positionNode, colorNode, version} = material;
    const other = makeTable(64, 4);

    material.setTexture('frameTable', other);

    expect([material.positionNode, material.colorNode, material.version]).toEqual([positionNode, colorNode, version]);
    expect(samplesTexture(material.colorNode!, other)).toBe(true);
    expect(material.resources.textureSize('frameTable').value.toArray()).toEqual([64, 4]);
    material.dispose();
  });

  test('with views the frame reads the position, the yaw and the camera', () => {
    const material = new FeatureSpritesMaterial(viewKind, {textures: {colorMap: new Texture(), frameTable: makeTable()}});
    const names = attributeNamesOf(material.colorNode!);
    expect(names).toContain('frameIndex');
    expect(names).toContain('yaw');
    expect(names).toContain('instancePosition');
    expect(nodesOf(material.colorNode!).has(cameraPosition)).toBe(true);
    material.dispose();
  });

  test('rounds frameIndex half up: 1.5 and 2.5 read the frames 2 and 3', () => {
    // the texels the frame stage reads out of a table of 64 × 1 that holds 16 entries, sorted
    const texelsRead = (frameIndex: number) => {
      const uvs: Node<'vec2'>[] = [];
      TableFrame.frame!({
        ...stubShaderContext(),
        attribute: <T extends string>(name: string) => uniform(name === 'frameIndex' ? frameIndex : 0) as unknown as Node<T>,
        sample: (_name, uv) => {
          uvs.push(uv);
          return vec4(16, 0, 0, 0) as unknown as Node<'vec4'>;
        },
        textureSize: () => vec2(64, 1) as unknown as Node<'vec2'>,
      });
      return uvs.map((uv) => Math.round((evaluateNode(uv) as number[])[0]! * 64 - 0.5)).sort((a, b) => a - b);
    };

    // t = 1 + 3 · frame, the first texel of the frame
    expect(texelsRead(2.5)).toEqual([0, 10, 11, 12]);
    expect(texelsRead(1.5)).toEqual([0, 7, 8, 9]);
  });
});
