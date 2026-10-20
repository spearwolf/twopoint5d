import {Group, OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {describe, expect, expectTypeOf, test} from 'vitest';

import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {BillboardPlacement} from '../features/BillboardPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {QuadSize} from '../features/QuadSize.js';
import {Rotation} from '../features/Rotation.js';
import {TextureColor} from '../features/TextureColor.js';
import {Tint} from '../features/Tint.js';
import {ReflectionPass} from '../passes/passPresets.js';
import {QuadBase} from '../SpriteBase.js';
import {defineFeature} from '../SpriteFeature.js';
import {FeatureSprites, type SpriteSortKeyName} from './FeatureSprites.js';

const kind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, BillboardPlacement, QuadSize, Rotation, TextureColor, Tint],
});

type Sprite = SpriteOf<typeof kind>;
type Api = NonNullable<(typeof kind)['__api']>;

function makeSprites(positions: [number, number, number][], capacity = positions.length) {
  const sprites = new FeatureSprites(kind, {capacity, passes: [ReflectionPass]});
  const all = positions.map(([x, y, z], id) => {
    const sprite = sprites.createSprite()!;
    sprite.setPosition(x, y, z);
    sprite.rotation = id;
    return sprite;
  });
  return {sprites, all};
}

// every sprite carries its id in its rotation
const idsInSlotOrder = (sprites: FeatureSprites<Api>): number[] => {
  const pool = sprites.spritePool!;
  return Array.from({length: pool.usedCount}, (_, i) => pool.getVO(i)!.rotation);
};

const cameraAt = (z: number) => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, z);
  camera.lookAt(0, 0, 0);
  return camera;
};

describe('FeatureSprites#sortBy()', () => {
  test('sorts the sprites by a number property of their handle, and their passes with them', () => {
    const {sprites, all} = makeSprites([
      [0, 3, 0],
      [0, 1, 0],
      [0, 2, 0],
    ]);

    expect(sprites.sortBy('y')).toBe(true);
    expect(idsInSlotOrder(sprites)).toEqual([1, 2, 0]);
    // the pass draws the very geometry the sprites draw, so it draws the same order
    expect(sprites.passes['reflection']!.geometry).toBe(sprites.geometry);

    expect(sprites.sortBy('y', {descending: true})).toBe(true);
    expect(idsInSlotOrder(sprites)).toEqual([0, 2, 1]);
    expect(all.map((sprite) => sprite.y)).toEqual([3, 1, 2]);
    sprites.dispose();
  });

  test('sorts by a key function of the sprite', () => {
    const {sprites} = makeSprites([
      [2, 0, 0],
      [-1, 0, 0],
      [5, 0, 0],
    ]);
    sprites.sortBy((sprite) => -sprite.x);
    expect(idsInSlotOrder(sprites)).toEqual([2, 0, 1]);
    sprites.dispose();
  });

  test('takes the names of the number properties of the handle', () => {
    expectTypeOf<SpriteSortKeyName<{y: number; setPosition(): void; label: string}>>().toEqualTypeOf<'y'>();
    expectTypeOf<SpriteSortKeyName<Sprite>>().toEqualTypeOf<
      'x' | 'y' | 'z' | 'width' | 'height' | 'rotation' | 'r' | 'g' | 'b' | 'a'
    >();
    expectTypeOf<FeatureSprites<Api>['sortBy']>()
      .parameter(0)
      .toEqualTypeOf<SpriteSortKeyName<Api> | ((sprite: Sprite) => number)>();
  });

  test('refuses a name that is no value property, naming the ones there are', () => {
    const {sprites} = makeSprites([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(() => sprites.sortBy('nope' as 'y')).toThrow(/"nope" is no value property .* name one of/);
    sprites.dispose();
  });

  test('does nothing once disposed and answers false', () => {
    const {sprites} = makeSprites([
      [0, 1, 0],
      [0, 0, 0],
    ]);
    sprites.dispose();
    expect(sprites.sortBy('y')).toBe(false);
    expect(sprites.sortByViewDepth(cameraAt(10))).toBe(false);
  });
});

describe('FeatureSprites#sortByViewDepth()', () => {
  const positions: [number, number, number][] = [
    [0, 0, 1],
    [1, 0, -2],
    [-1, 2, 0],
  ];

  test('draws the farthest sprite first', () => {
    const {sprites} = makeSprites(positions);

    expect(sprites.sortByViewDepth(cameraAt(10))).toBe(true);
    expect(idsInSlotOrder(sprites)).toEqual([1, 2, 0]);
    // the order holds: nothing moves, nothing to upload
    expect(sprites.sortByViewDepth(cameraAt(10))).toBe(false);

    expect(sprites.sortByViewDepth(cameraAt(-10))).toBe(true);
    expect(idsInSlotOrder(sprites)).toEqual([0, 2, 1]);
    sprites.dispose();
  });

  test('measures in view space, through the world matrix of the mesh and of its parents', () => {
    const {sprites} = makeSprites(positions);
    const parent = new Group();
    parent.add(sprites);
    // half a turn about y: the local z of the sprites points away from the camera on +z
    parent.rotation.y = Math.PI;
    sprites.position.x = 4;

    sprites.sortByViewDepth(cameraAt(10));
    expect(idsInSlotOrder(sprites)).toEqual([0, 2, 1]);
    sprites.dispose();
  });

  test('orders the same for an orthographic camera', () => {
    const {sprites} = makeSprites(positions);
    const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    sprites.sortByViewDepth(camera);
    expect(idsInSlotOrder(sprites)).toEqual([1, 2, 0]);
    sprites.dispose();
  });

  test('takes the view of a camera looking down at the ground', () => {
    const {sprites} = makeSprites([
      [0, 0, 5],
      [0, 0, -5],
      [0, 0, 0],
    ]);
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 10, 10);
    camera.lookAt(0, 0, 0);

    sprites.sortByViewDepth(camera);
    expect(idsInSlotOrder(sprites)).toEqual([1, 2, 0]);
    sprites.dispose();
  });

  test('refuses a kind without instancePosition, naming the fix', () => {
    const fixed = defineSprite({
      base: QuadBase,
      features: [defineFeature({name: 'fixedPlacement', placement: (local) => local}), QuadSize, TextureColor],
    });
    const sprites = new FeatureSprites(fixed, {capacity: 2});
    sprites.createSprite();
    sprites.createSprite();
    expect(() => sprites.sortByViewDepth(cameraAt(10))).toThrow(
      'FeatureSprites#sortByViewDepth(): the sprites of this kind have no instancePosition to measure the view depth at — add InstancePosition to the features of the kind, or sort by a key of your own with sortBy()',
    );
    sprites.dispose();
  });

  test('answers false with fewer than two sprites', () => {
    const {sprites} = makeSprites([[0, 0, 0]], 4);
    expect(sprites.sortByViewDepth(cameraAt(10))).toBe(false);
    sprites.dispose();
  });
});
