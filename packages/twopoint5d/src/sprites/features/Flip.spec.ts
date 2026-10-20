import {uniform, vec4} from 'three/tsl';
import {type Node, Vector2, Vector4} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {attributeNamesOf, evaluateNode, stubShaderContext} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {QuadBase} from '../SpriteBase.js';
import {FrameOrder, type SpriteFrameNodes} from '../SpriteFeature.js';
import {FlatPlacement} from './FlatPlacement.js';
import {Flip} from './Flip.js';
import {InstancePosition} from './InstancePosition.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, Flip]});
const makePool = () => new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);

// a frame context whose `flip` attribute is a uniform of the values given
const flipContext = (flipX: number, flipY: number) => ({
  ...stubShaderContext(),
  attribute: <T extends string>(_name: string) => uniform(new Vector2(flipX, flipY)) as unknown as Node<T>,
});

const vec4Of = (x: number, y: number, z: number, w: number) => uniform(new Vector4(x, y, z, w)) as unknown as Node<'vec4'>;

const FRAME: SpriteFrameNodes = {
  texCoords: vec4Of(0.25, 0.5, 0.5, 0.25),
  trim: vec4Of(0.1, 0.2, 0.3, 0.4),
};

const closeTo = (actual: unknown, expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  (actual as number[]).forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
};

const flipped = (frame: SpriteFrameNodes, flipX: number, flipY: number) => {
  const result = Flip.frameStage!.transform(frame, flipContext(flipX, flipY));
  return {
    texCoords: evaluateNode(result.texCoords),
    trim: evaluateNode(result.trim!),
    mirror: evaluateNode(result.mirror!),
    result,
  };
};

describe('Flip', () => {
  test('declares the static flip attribute and a frame stage in the flip band', () => {
    expect(Flip.name).toBe('flip');
    expect(Flip.attributes).toEqual({flip: {components: ['flipX', 'flipY']}});
    expect(Flip.frameStage!.order).toBe(FrameOrder.Flip);
    expect(Flip.local).toBeUndefined();
  });

  test('a sprite starts unflipped, whatever its slot held before', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.setFlip(1, 1);
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.flipX, again.flipY]).toEqual([0, 0]);
    pool.dispose();
  });

  test('setFlip() writes both flags', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;

    sprite.setFlip(1, 0);
    expect([sprite.flipX, sprite.flipY]).toEqual([1, 0]);
    sprite.setFlip([0, 1]);
    expect([sprite.flipX, sprite.flipY]).toEqual([0, 1]);
    pool.dispose();
  });

  test('leaves the frame as it is unflipped', () => {
    const {texCoords, trim, mirror} = flipped(FRAME, 0, 0);

    closeTo(texCoords, [0.25, 0.5, 0.5, 0.25]);
    closeTo(trim, [0.1, 0.2, 0.3, 0.4]);
    closeTo(mirror, [0, 0]);
  });

  test('mirrors along x: s + u, −u, and the trim margins left for right', () => {
    const {texCoords, trim, mirror} = flipped(FRAME, 1, 0);

    closeTo(texCoords, [0.75, 0.5, -0.5, 0.25]);
    closeTo(trim, [0.3, 0.2, 0.1, 0.4]);
    closeTo(mirror, [1, 0]);
  });

  test('mirrors along y: t + v, −v, and the trim margins top for bottom', () => {
    const {texCoords, trim, mirror} = flipped(FRAME, 0, 1);

    closeTo(texCoords, [0.25, 0.75, 0.5, -0.25]);
    closeTo(trim, [0.1, 0.4, 0.3, 0.2]);
    closeTo(mirror, [0, 1]);
  });

  test('reads a flag above 0.5 as 1 and one below it as 0', () => {
    const {texCoords, mirror} = flipped(FRAME, 0.7, 0.3);

    closeTo(texCoords, [0.75, 0.5, -0.5, 0.25]);
    closeTo(mirror, [1, 0]);
  });

  test('mirrors a turned frame the same way: the drawn x is the s axis', () => {
    const turned: SpriteFrameNodes = {texCoords: vec4Of(0.5, 0, 0.25, 1), flipDiagonal: uniform(1) as unknown as Node<'float'>};

    const {texCoords, result} = flipped(turned, 1, 1);

    closeTo(texCoords, [0.75, 1, -0.25, -1]);
    expect(result.flipDiagonal).toBe(turned.flipDiagonal);
  });

  test('gives a frame without trim margins margins of 0', () => {
    const {trim} = flipped({texCoords: vec4(0, 0, 1, 1) as unknown as Node<'vec4'>}, 1, 1);

    closeTo(trim, [0, 0, 0, 0]);
  });

  test('two mirrors along one axis cancel', () => {
    const mirroredBefore: SpriteFrameNodes = {...FRAME, mirror: uniform(new Vector2(1, 1)) as unknown as Node<'vec2'>};

    closeTo(flipped(mirroredBefore, 1, 0).mirror, [0, 1]);
  });

  test('reads the flip and nothing of the position: the triangles never turn over', () => {
    const result = Flip.frameStage!.transform(FRAME, stubShaderContext());

    expect(attributeNamesOf(result.texCoords)).toEqual(['flip']);
    expect(attributeNamesOf(result.trim!)).toEqual(['flip']);
  });
});
