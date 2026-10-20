import {cameraPosition} from 'three/tsl';
import {Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {attributeNamesOf, nodesOf, samplesTexture, textureNodesOf} from '../../testing/spriteGraph.js';
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

  test.each([1, 0, 2.5, -8, '8'])('refuses views of %o', (views) => {
    expect(() => tableFrame({views: views as number})).toThrow(TypeError);
    expect(() => tableFrame({views: views as number})).toThrow(
      `tableFrame: views must be a whole number of 2 or more, got ${JSON.stringify(views)} — leave views out for frames without views`,
    );
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
});
