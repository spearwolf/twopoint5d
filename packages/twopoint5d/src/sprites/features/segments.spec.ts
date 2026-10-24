import {cameraPosition, modelViewMatrix, uniform, vec3} from 'three/tsl';
import {type Node, Vector3} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, nodesOf, stubShaderContext} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {FeatureSpritesMaterial} from '../FeatureSprites/FeatureSpritesMaterial.js';
import {gridBase} from '../GridBase.js';
import {QuadBase} from '../SpriteBase.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {QuadSize} from './QuadSize.js';
import {Rotation} from './Rotation.js';
import {SegmentEnd} from './SegmentEnd.js';
import {SegmentPlacement, type SegmentPlacementOptions, segmentPlacement} from './SegmentPlacement.js';
import {Shear} from './Shear.js';
import {type SegmentFacing, segmentVertex} from './segmentVertex.js';

type Vec = readonly [number, number, number];

const v3 = (value: Vec) => uniform(new Vector3(...value)) as unknown as Node<'vec3'>;

/** The vertex of a segment from `start` to `end` at `along`, for the local vertex `local`. */
const vertexOf = (
  facing: SegmentFacing,
  {start, end, along, local}: {start: Vec; end: Vec; along: number; local: Vec},
  camera: {position: Vec; right: Vec; up: Vec} = {position: [0, 0, 10], right: [1, 0, 0], up: [0, 1, 0]},
) =>
  evaluateNode(
    segmentVertex({
      local: v3(local),
      start: v3(start),
      end: v3(end),
      along: uniform(along) as unknown as Node<'float'>,
      facing,
      camera: {position: v3(camera.position), right: v3(camera.right), up: v3(camera.up)},
    }),
  ) as number[];

const expectClose = (actual: number[], expected: Vec) => {
  expect(actual).toHaveLength(3);
  actual.forEach((value, i) => {
    expect(Number.isFinite(value), `component ${i} of [${actual}] is finite`).toBe(true);
    expect(value, `component ${i} of [${actual}]`).toBeCloseTo(expected[i]!, 6);
  });
};

const kindOf = (...features: Parameters<typeof defineSprite>[0]['features']) =>
  defineSprite({base: QuadBase, features: [InstancePosition, SegmentEnd, ...features]});

describe('SegmentEnd', () => {
  const kind = kindOf(SegmentPlacement);
  const makeSprite = () => {
    const pool = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);
    return {pool, sprite: pool.createVO()!};
  };

  test('declares the dynamic segmentEnd attribute and is data alone', () => {
    const {name, attributes, initialize, ...rest} = SegmentEnd;

    expect(name).toBe('segmentEnd');
    expect(attributes).toEqual({segmentEnd: {components: ['endX', 'endY', 'endZ'], usage: 'dynamic'}});
    expect(typeof initialize).toBe('function');
    expect(Object.keys(rest)).toEqual([]);
  });

  test('setSegmentEnd() writes the end, as values or as a tuple, and keeps z without one', () => {
    const {pool, sprite} = makeSprite();

    sprite.setSegmentEnd(1, 2, 3);
    expect([sprite.endX, sprite.endY, sprite.endZ]).toEqual([1, 2, 3]);
    sprite.setSegmentEnd(4, 5);
    expect([sprite.endX, sprite.endY, sprite.endZ]).toEqual([4, 5, 3]);
    sprite.setSegmentEnd([6, 7]);
    expect([sprite.endX, sprite.endY, sprite.endZ]).toEqual([6, 7, 3]);
    sprite.setSegmentEnd([8, 9, 10]);
    expect([sprite.endX, sprite.endY, sprite.endZ]).toEqual([8, 9, 10]);
    pool.dispose();
  });

  test('a segment ends at the origin, whatever its slot held before', () => {
    const {pool, sprite} = makeSprite();
    sprite.setSegmentEnd(1, 2, 3);
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.endX, again.endY, again.endZ]).toEqual([0, 0, 0]);
    pool.dispose();
  });
});

describe('segmentPlacement()', () => {
  test('answers one frozen feature per set of options', () => {
    expect(segmentPlacement()).toBe(SegmentPlacement);
    expect(segmentPlacement({})).toBe(SegmentPlacement);
    expect(segmentPlacement({facing: 'plane', plane: 'xy'})).toBe(SegmentPlacement);
    expect(segmentPlacement({plane: 'xz'})).toBe(segmentPlacement({facing: 'plane', plane: 'xz'}));
    expect(segmentPlacement({facing: 'camera'})).toBe(segmentPlacement({facing: 'camera'}));
    expect(segmentPlacement({facing: 'camera'})).not.toBe(SegmentPlacement);
    expect(Object.isFrozen(SegmentPlacement)).toBe(true);
  });

  test('names each form, requires the two ends and brings nothing but its placement and its check', () => {
    const forms: [SegmentPlacementOptions, string][] = [
      [{}, 'segmentPlacement'],
      [{plane: 'xz'}, 'segmentPlacement+xz'],
      [{facing: 'camera'}, 'segmentPlacement+camera'],
    ];
    for (const [options, expected] of forms) {
      const {name, requires, placement, checkKind, ...rest} = segmentPlacement(options);
      expect(name).toBe(expected);
      expect(requires).toEqual(['instancePosition', 'segmentEnd']);
      expect([typeof placement, typeof checkKind]).toEqual(['function', 'function']);
      expect(Object.keys(rest)).toEqual([]);
    }
  });

  test.each([
    [5, '5'],
    ['x', '"x"'],
    [null, 'null'],
  ])('refuses options of %o that are no object', (options, shown) => {
    expect(() => segmentPlacement(options as never)).toThrow(TypeError);
    expect(() => segmentPlacement(options as never)).toThrow(
      `segmentPlacement: the options must be an object, {facing?, plane?}, got ${shown}`,
    );
  });

  test('takes options that are undefined', () => {
    expect(() => segmentPlacement(undefined)).not.toThrow();
  });

  test('refuses a facing or a plane it does not know, and a plane next to the camera', () => {
    expect(() => segmentPlacement({facing: 'light' as 'plane'})).toThrow(
      new TypeError(`segmentPlacement: the facing "light" is neither 'plane' nor 'camera'`),
    );
    expect(() => segmentPlacement({plane: 'yz' as 'xy'})).toThrow(
      new TypeError(`segmentPlacement: the plane "yz" is neither 'xy' nor 'xz'`),
    );
    expect(() => segmentPlacement({facing: NaN as unknown as 'plane'})).toThrow(
      new TypeError(`segmentPlacement: the facing NaN is neither 'plane' nor 'camera'`),
    );
    expect(() => segmentPlacement({plane: NaN as unknown as 'xy'})).toThrow(
      new TypeError(`segmentPlacement: the plane NaN is neither 'xy' nor 'xz'`),
    );
    expect(() => segmentPlacement({facing: 'camera', plane: 'xy'})).toThrow(
      new TypeError(
        "segmentPlacement: a plane belongs to facing: 'plane' — a segment that faces the camera turns in every plane; drop the plane, or take facing: 'plane'",
      ),
    );
  });

  test('is refused next to Rotation or Shear, naming the fix', () => {
    const reason = (stages: string, names: string, exports: string) =>
      `defineSprite: feature "segmentPlacement": a segment lies along its ends, so it cannot follow the local ${stages} of ${names} — move the ends instead, and take ${exports} out of the kind`;

    expect(() => kindOf(SegmentPlacement, QuadSize, Rotation)).toThrow(reason('stage', '"rotation"', 'Rotation'));
    expect(() => kindOf(SegmentPlacement, Shear)).toThrow(reason('stage', '"shear"', 'Shear'));
    expect(() => kindOf(SegmentPlacement, Shear, Rotation)).toThrow(
      reason('stages', '"rotation" and "shear"', 'Rotation and Shear'),
    );
  });

  test('keeps the error of its check as the cause', () => {
    try {
      kindOf(segmentPlacement({facing: 'camera'}), Rotation);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toMatch(/^defineSprite: feature "segmentPlacement\+camera": a segment lies/);
      expect((error as Error).cause).toBeInstanceOf(Error);
    }
  });

  test('is refused without the end of the segment', () => {
    expect(() => defineSprite({base: QuadBase, features: [InstancePosition, SegmentPlacement]})).toThrow(
      'defineSprite: feature "segmentPlacement" requires feature "segmentEnd", which this sprite kind does not hold',
    );
  });

  test('builds the position graph of a kind on the quad and on a grid', () => {
    for (const base of [QuadBase, gridBase({columns: 4, rows: 1})]) {
      const kind = defineSprite({base, features: [InstancePosition, SegmentEnd, SegmentPlacement, QuadSize]});
      const material = new FeatureSpritesMaterial(kind);

      expect(material.positionNode).not.toBeNull();
      material.dispose();
    }
  });

  test('a segment facing the camera reads the camera, one in a plane does not', () => {
    const ctx = stubShaderContext();
    const local = vec3(0, 0, 0) as unknown as Node<'vec3'>;
    const reads = (feature: typeof SegmentPlacement) => [...nodesOf(feature.placement!(local, ctx))];

    expect(reads(segmentPlacement({facing: 'camera'})).some((node) => node === cameraPosition)).toBe(true);
    expect(reads(segmentPlacement({facing: 'camera'})).some((node) => node === modelViewMatrix)).toBe(true);
    expect(reads(SegmentPlacement).some((node) => node === cameraPosition)).toBe(false);
  });

  test('the segment placements stand in for each other on a live material', () => {
    const kind = kindOf(SegmentPlacement, QuadSize);
    const material = new FeatureSpritesMaterial(kind);
    material.placement = segmentPlacement({facing: 'camera'});
    material.placement = segmentPlacement({plane: 'xz'});
    material.placement = SegmentPlacement;

    expect(material.placement).toBe(SegmentPlacement);
    material.dispose();
  });

  test('stands in for a flat placement of a kind with an end, and is refused on one with a Rotation', () => {
    const material = new FeatureSpritesMaterial(kindOf(FlatPlacement, QuadSize));
    material.placement = SegmentPlacement;
    expect(material.placement).toBe(SegmentPlacement);
    material.dispose();

    const turning = new FeatureSpritesMaterial(kindOf(FlatPlacement, QuadSize, Rotation));
    expect(() => {
      turning.placement = SegmentPlacement;
    }).toThrow('FeatureSpritesMaterial: feature "segmentPlacement": a segment lies along its ends');
    turning.dispose();
  });
});

describe('segmentVertex()', () => {
  const start: Vec = [1, 2, 0];
  const end: Vec = [5, 2, 0];

  test('lies at the point along the segment the base uv names', () => {
    expectClose(vertexOf('xy', {start, end, along: 0, local: [0, 0, 0]}), [1, 2, 0]);
    expectClose(vertexOf('xy', {start, end, along: 0.25, local: [0, 0, 0]}), [2, 2, 0]);
    expectClose(vertexOf('xy', {start, end, along: 1, local: [0, 0, 0]}), [5, 2, 0]);
  });

  test('moves on along the segment by the local x, the caps, and across it by the local y, the thickness', () => {
    expectClose(vertexOf('xy', {start, end, along: 0, local: [-0.5, 0.25, 0]}), [0.5, 2.25, 0]);
    expectClose(vertexOf('xy', {start, end, along: 1, local: [0.5, -0.25, 0]}), [5.5, 1.75, 0]);
  });

  test("in 'xy' the across is the left of the direction, and the local z the front, +Z for a segment to the right", () => {
    expectClose(vertexOf('xy', {start: [0, 0, 0], end: [0, 4, 0], along: 0, local: [0, 1, 0]}), [-1, 0, 0]);
    expectClose(vertexOf('xy', {start: [0, 0, 0], end: [3, 4, 0], along: 0, local: [0, 5, 0]}), [-4, 3, 0]);
    expectClose(vertexOf('xy', {start: [0, 0, 0], end: [4, 0, 0], along: 0, local: [0, 0, 1]}), [0, 0, 1]);
  });

  test("in 'xz' a segment along +X shows its top towards −Z and faces +Y, as GroundPlacement lays a sprite", () => {
    expectClose(vertexOf('xz', {start: [0, 0, 0], end: [4, 0, 0], along: 0, local: [0, 1, 0]}), [0, 0, -1]);
    expectClose(vertexOf('xz', {start: [0, 0, 0], end: [4, 0, 0], along: 0, local: [0, 0, 1]}), [0, 1, 0]);
    expectClose(vertexOf('xz', {start: [0, 0, 0], end: [0, 0, 4], along: 0, local: [0, 1, 0]}), [1, 0, 0]);
  });

  test('a segment of no length draws its caps quad in the plane', () => {
    const at = (facing: SegmentFacing) => vertexOf(facing, {start: [2, 2, 2], end: [2, 2, 2], along: 1, local: [0.5, 0.25, 0]});

    expectClose(at('xy'), [2.5, 2.25, 2]);
    expectClose(at('xz'), [2.5, 2, 1.75]);
  });

  test('a segment along the normal of its plane takes the up of the plane as its across', () => {
    expectClose(vertexOf('xy', {start: [0, 0, 0], end: [0, 0, 4], along: 0, local: [0, 1, 0]}), [0, 1, 0]);
    expectClose(vertexOf('xz', {start: [0, 0, 0], end: [0, 4, 0], along: 0, local: [0, 1, 0]}), [0, 0, -1]);
  });

  test('facing the camera from the front, the across is up and the front faces the camera', () => {
    const camera = {position: [0, 0, 10] as Vec, right: [1, 0, 0] as Vec, up: [0, 1, 0] as Vec};

    expectClose(vertexOf('camera', {start: [-4, 0, 0], end: [4, 0, 0], along: 0, local: [0, 1, 0]}, camera), [-4, 1, 0]);
    expectClose(vertexOf('camera', {start: [-4, 0, 0], end: [4, 0, 0], along: 1, local: [0, 1, 0]}, camera), [4, 1, 0]);
    const front = vertexOf('camera', {start: [-4, 0, 0], end: [4, 0, 0], along: 0.5, local: [0, 0, 1]}, camera);
    expectClose(front, [0, 0, 1]);
  });

  test('facing a camera above, the same segment turns its across to −Z, the up of that camera', () => {
    const camera = {position: [0, 10, 0] as Vec, right: [1, 0, 0] as Vec, up: [0, 0, -1] as Vec};

    expectClose(vertexOf('camera', {start: [-4, 0, 0], end: [4, 0, 0], along: 0.5, local: [0, 1, 0]}, camera), [0, 0, -1]);
    expectClose(vertexOf('camera', {start: [-4, 0, 0], end: [4, 0, 0], along: 0.5, local: [0, 0, 1]}, camera), [0, 1, 0]);
  });

  test('a segment of no length facing the camera takes the right of the camera as its direction', () => {
    const camera = {position: [0, 0, 10] as Vec, right: [0, -1, 0] as Vec, up: [1, 0, 0] as Vec};

    expectClose(vertexOf('camera', {start: [0, 0, 0], end: [0, 0, 0], along: 0, local: [1, 2, 0]}, camera), [2, -1, 0]);
  });

  test('a segment that points at the camera takes the up of the camera as its across, finite', () => {
    const camera = {position: [0, 0, 10] as Vec, right: [1, 0, 0] as Vec, up: [0, 1, 0] as Vec};

    expectClose(vertexOf('camera', {start: [0, 0, -2], end: [0, 0, 2], along: 0.5, local: [0, 1, 0]}, camera), [0, 1, 0]);
    // the up of the camera pointing the other way round is turned to the side it is weighed against
    const rolled = {...camera, up: [0, -1, 0] as Vec};
    expectClose(vertexOf('camera', {start: [0, 0, -2], end: [0, 0, 2], along: 0.5, local: [0, 1, 0]}, rolled), [0, -1, 0]);
  });

  test('inside the cone round the look a camera rolled against the facing does not cancel it', () => {
    // at a sine of 1/11 the facing across and the weighted up of the camera have the same length
    const sine = 1 / 11;
    const camera = {
      position: [0, 10 * sine, 10 * Math.sqrt(1 - sine * sine)] as Vec,
      right: [1, 0, 0] as Vec,
      up: [-1, 0, 0] as Vec,
    };

    const placed = vertexOf('camera', {start: [0, 0, 0], end: [0, 0, 1], along: 0, local: [0, 1, 0]}, camera);

    placed.forEach((value) => expect(Number.isFinite(value)).toBe(true));
    expect(Math.hypot(...placed)).toBeCloseTo(1, 6);
  });

  test('a camera whose up lies along a segment that points at it draws a line, not NaN', () => {
    const camera = {position: [0, 0, 10] as Vec, right: [1, 0, 0] as Vec, up: [0, 0, 1] as Vec};

    expectClose(vertexOf('camera', {start: [0, 0, -2], end: [0, 0, 2], along: 0.5, local: [0, 1, 0]}, camera), [0, 0, 0]);
  });
});
