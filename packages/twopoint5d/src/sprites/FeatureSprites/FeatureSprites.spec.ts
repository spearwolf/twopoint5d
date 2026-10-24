import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {mul} from 'three/tsl';
import type {MeshBasicMaterial, Vector3, Vector4} from 'three/webgpu';
import {Mesh, Object3D, PerspectiveCamera, PlaneGeometry, PointLight, Scene, Texture} from 'three/webgpu';
import {afterEach, describe, expect, expectTypeOf, test, vi} from 'vitest';

import {nodesOf} from '../../testing/spriteGraph.js';
import {lightOf} from '../bindings/lightOf.js';
import {planeOf} from '../bindings/planeOf.js';
import type {SpriteUniformSource} from '../bindings/SpriteUniformSource.js';
import {defineSprite, type SpriteKindApiOf} from '../defineSprite.js';
import {AtlasFrame} from '../features/AtlasFrame.js';
import {BillboardPlacement} from '../features/BillboardPlacement.js';
import {FlatPlacement} from '../features/FlatPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {QuadSize} from '../features/QuadSize.js';
import {Rotation} from '../features/Rotation.js';
import {TextureColor} from '../features/TextureColor.js';
import {Tint} from '../features/Tint.js';
import {definePass, type SpritePass} from '../passes/definePass.js';
import {ReflectionPass, ShadowPass} from '../passes/passPresets.js';
import {AnimatedSpriteKind, TexturedSpriteKind} from '../presets.js';
import {QuadBase} from '../SpriteBase.js';
import {defineFeature} from '../SpriteFeature.js';
import {FeatureSprites, type FeatureSpritesOf} from './FeatureSprites.js';
import {FeatureSpritesGeometry} from './FeatureSpritesGeometry.js';
import {FeatureSpritesMaterial} from './FeatureSpritesMaterial.js';
import {SpriteResources} from './SpriteResources.js';

const kind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint],
});
const other = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement]});

describe('FeatureSprites', () => {
  const sandbox = createSandbox();
  afterEach(() => sandbox.restore());

  test('builds a geometry of 100 sprites and a material of the kind when it is handed neither', () => {
    const sprites = new FeatureSprites(kind);

    expect(sprites.geometry).toBeInstanceOf(FeatureSpritesGeometry);
    expect(sprites.geometry!.instancedPool.capacity).toBe(100);
    expect(sprites.material).toBeInstanceOf(FeatureSpritesMaterial);
    expect(sprites.kind).toBe(kind);
    expect(sprites.name).toBe('twopoint5d.FeatureSprites');
    expect(sprites.frustumCulled).toBe(false);
    sprites.dispose();
  });

  test('builds its geometry and material from the options', () => {
    const colorMap = new Texture();
    const sprites = new FeatureSprites(kind, {
      capacity: 8,
      attributeUsage: {dynamic: ['size']},
      textures: {colorMap},
      transparent: true,
      placement: BillboardPlacement,
    });

    expect(sprites.spritePool!.capacity).toBe(8);
    expect(sprites.geometry!.instancedPool.descriptor.getAttribute('quadSize')!.usageType).toBe('dynamic');
    expect(sprites.getTexture('colorMap')).toBe(colorMap);
    expect(sprites.material!.transparent).toBe(true);
    expect(sprites.placement).toBe(BillboardPlacement);
    sprites.dispose();
  });

  test('createSprite() hands out a sprite of the kind, freeSprite() takes it back, undefined once full', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sprites = new FeatureSprites(kind, {capacity: 1});
    const sprite = sprites.createSprite()!;

    expect(sprites.spritePool!.usedCount).toBe(1);
    expect(sprites.createSprite()).toBeUndefined();
    sprites.freeSprite(sprite);
    expect(sprites.spritePool!.usedCount).toBe(0);
    expectTypeOf(sprite).toHaveProperty('setFrame');
    sprites.dispose();
  });

  test('FeatureSpritesOf<typeof kind> is the type of the mesh of the kind (a type-level check)', () => {
    const sprites: FeatureSpritesOf<typeof kind> = new FeatureSprites(kind, {capacity: 1});

    expectTypeOf(sprites).toEqualTypeOf<FeatureSprites<SpriteKindApiOf<typeof kind>>>();
    expectTypeOf(sprites.createSprite()!).toHaveProperty('setFrame');
    expectTypeOf<FeatureSpritesOf<number>>().toBeNever();
    sprites.dispose();
  });

  describe('a full pool', () => {
    const silenced = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

    test('warns once, naming the mesh, the capacity and the fix', () => {
      const warn = silenced();
      const sprites = new FeatureSprites(kind, {capacity: 2});
      sprites.createSprite();
      sprites.createSprite();
      expect(warn).not.toHaveBeenCalled();

      expect(sprites.createSprite()).toBeUndefined();
      expect(sprites.createSprite()).toBeUndefined();

      expect(warn.mock.calls).toEqual([
        [
          'FeatureSprites "twopoint5d.FeatureSprites": the pool is full — all 2 sprites are in use, so createSprite() answers undefined. Give the sprites a larger capacity — new FeatureSprites(kind, {capacity: 4}) — or free the sprites no longer drawn with freeSprite(). This warning is shown once per FeatureSprites.',
        ],
      ]);
      sprites.dispose();
    });

    test('warns once only, also after sprites were freed and the pool filled up again', () => {
      const warn = silenced();
      const sprites = new FeatureSprites(kind, {capacity: 1});
      sprites.name = 'enemies';
      const sprite = sprites.createSprite()!;
      sprites.createSprite();
      sprites.freeSprite(sprite);
      sprites.createSprite();
      sprites.createSprite();

      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]![0]).toMatch(/^FeatureSprites "enemies": the pool is full — all 1 sprites/);
      sprites.dispose();
    });

    test('names the geometry handed in as the one to build larger', () => {
      const warn = silenced();
      const geometry = new FeatureSpritesGeometry(kind, 3);
      const sprites = new FeatureSprites(kind, {geometry});
      for (let i = 0; i < 4; i++) sprites.createSprite();

      expect(warn.mock.calls[0]![0]).toContain(
        'Build the FeatureSpritesGeometry in the geometry slot with a larger capacity — new FeatureSpritesGeometry(kind, {capacity: 6}) —',
      );
      sprites.dispose();
      geometry.dispose();
    });

    test('names the geometry put into the slot as the one to build larger', () => {
      const warn = silenced();
      const sprites = new FeatureSprites(kind, {capacity: 2});
      const other = new FeatureSpritesGeometry(kind, 3);
      sprites.geometry = other;
      for (let i = 0; i < 4; i++) sprites.createSprite();

      expect(warn.mock.calls[0]![0]).toContain(
        'Build the FeatureSpritesGeometry in the geometry slot with a larger capacity — new FeatureSpritesGeometry(kind, {capacity: 6}) —',
      );
      sprites.dispose();
      other.dispose();
    });

    test('a pool of no sprites asks for one', () => {
      const warn = silenced();
      const sprites = new FeatureSprites(kind, {capacity: 0});

      expect(sprites.createSprite()).toBeUndefined();
      expect(warn.mock.calls[0]![0]).toContain('all 0 sprites are in use');
      expect(warn.mock.calls[0]![0]).toContain('new FeatureSprites(kind, {capacity: 1})');
      sprites.dispose();
    });

    test('disposed sprites answer undefined without a warning', () => {
      const warn = silenced();
      const sprites = new FeatureSprites(kind, {capacity: 1});
      sprites.dispose();

      expect(sprites.createSprite()).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  test('createSprite() hands out a sprite at the values of an unused slot — 0, and white — whatever its slot held', () => {
    const sprites = new FeatureSprites(kind, {capacity: 1});
    const sprite = sprites.createSprite()!;
    sprite.setSize(4, 4);
    sprite.setPosition(1, 2, 3);
    sprite.rotation = 1;
    sprite.setTexCoords(0.1, 0.2, 0.3, 0.4);
    sprite.setColorValues(0, 0, 0, 0);
    sprites.freeSprite(sprite);

    const again = sprites.createSprite()!;

    expect([again.width, again.height, again.x, again.y, again.z, again.rotation, again.s, again.t, again.u, again.v]).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect([again.r, again.g, again.b, again.a]).toEqual([1, 1, 1, 1]);
    sprites.dispose();
  });

  test('the placement setter swaps the placement of the material', () => {
    const sprites = new FeatureSprites(kind);

    sprites.placement = BillboardPlacement;

    expect(sprites.material!.placement).toBe(BillboardPlacement);
    sprites.dispose();
  });

  test('the placement setter refuses a malformed feature as defineFeature() would, and every material keeps its placement', () => {
    const sprites = new FeatureSprites(kind, {passes: [definePass({name: 'plain', features: []})]});

    expect(() => {
      sprites.placement = {name: 'odd', placement: 5} as never;
    }).toThrow(new TypeError('FeatureSprites: the placement of feature "odd" is no function'));
    expect(sprites.placement).toBe(FlatPlacement);
    expect(sprites.passes['plain']!.material.placement).toBe(FlatPlacement);
    sprites.dispose();
  });

  test('textures and uniforms pass through to the material', () => {
    const timedKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, TextureColor]});
    const sprites = new FeatureSprites(timedKind);
    const colorMap = new Texture();

    sprites.setTexture('colorMap', colorMap);
    sprites.touchTexture('colorMap');

    expect(sprites.getTexture('colorMap')).toBe(colorMap);
    expect(sprites.uniforms).toBe(sprites.material!.uniforms);
    sprites.dispose();
  });

  describe('refuses', () => {
    test('a geometry or a material built for another kind', () => {
      const geometry = new FeatureSpritesGeometry(other, 1);
      const material = new FeatureSpritesMaterial(other);

      expect(() => new FeatureSprites(kind, {geometry: geometry as never})).toThrow(
        'FeatureSprites: the geometry handed in was built for another sprite kind',
      );
      expect(() => new FeatureSprites(kind, {material: material as never})).toThrow(
        'FeatureSprites: the material handed in was built for another sprite kind',
      );
      geometry.dispose();
      material.dispose();
    });

    test('geometry parameters next to a geometry, and material parameters next to a material', () => {
      const geometry = new FeatureSpritesGeometry(kind, 1);
      const material = new FeatureSpritesMaterial(kind);

      expect(() => new FeatureSprites(kind, {geometry, capacity: 4})).toThrow(
        'FeatureSprites: capacity, attributeUsage and baseArgs build a geometry, and a geometry was handed in',
      );
      expect(() => new FeatureSprites(kind, {material, textures: {colorMap: new Texture()}})).toThrow(
        'FeatureSprites: textures build a material, and a material was handed in',
      );
      expect(() => new FeatureSprites(kind, {material, textures: undefined}).dispose()).not.toThrow();
      geometry.dispose();
      material.dispose();
    });

    test('a three.js material or a texture as its options (a type-level check)', () => {
      const withMaterial = (m: MeshBasicMaterial) =>
        // @ts-expect-error the options of a FeatureSprites only
        new FeatureSprites(kind, m);
      const withTexture = (t: Texture) =>
        // @ts-expect-error the options of a FeatureSprites only
        new FeatureSprites(kind, t);
      void withMaterial;
      void withTexture;
    });

    test('a pass among its options, which would build the material of the sprites as a pass material (a type-level check)', () => {
      const withPass = (pass: SpritePass) =>
        // @ts-expect-error a FeatureSprites draws the sprites themselves
        new FeatureSprites(kind, {pass});
      void withPass;
    });
  });

  test('the convenience API answers nothing once the sprites are disposed', () => {
    const sprites = new FeatureSprites(kind, {capacity: 1});
    const sprite = sprites.createSprite()!;

    sprites.dispose();

    expect(sprites.spritePool).toBeUndefined();
    expect(sprites.createSprite()).toBeUndefined();
    expect(() => sprites.freeSprite(sprite)).not.toThrow();
    expect(sprites.placement).toBeUndefined();
    expect(() => {
      sprites.placement = BillboardPlacement;
    }).not.toThrow();
    expect(sprites.uniforms).toBeUndefined();
    expect(sprites.getTexture('colorMap')).toBeUndefined();
    expect(() => sprites.setTexture('colorMap', new Texture())).not.toThrow();
    expect(() => sprites.touchTexture('colorMap')).not.toThrow();
    expect(() => sprites.setUniform('time', 1)).not.toThrow();
    expect(() => sprites.update()).not.toThrow();
  });

  describe('dispose()', () => {
    test('disposes the geometry and the material it built itself', () => {
      const sprites = new FeatureSprites(kind);
      const geometryDispose = sandbox.spy(sprites.geometry!, 'dispose');
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');

      sprites.dispose();

      expect([geometryDispose.calledOnce, materialDispose.calledOnce]).toEqual([true, true]);
    });

    test('does NOT dispose a geometry, a material or a texture handed in', () => {
      const geometry = new FeatureSpritesGeometry(kind, 1);
      const material = new FeatureSpritesMaterial(kind);
      const colorMap = new Texture();
      const geometryDispose = sandbox.spy(geometry, 'dispose');
      const materialDispose = sandbox.spy(material, 'dispose');
      const textureDispose = sandbox.spy(colorMap, 'dispose');

      new FeatureSprites(kind, {geometry, material}).dispose();
      new FeatureSprites(kind, {textures: {colorMap}}).dispose();

      expect([geometryDispose.called, materialDispose.called, textureDispose.called]).toEqual([false, false, false]);
      geometry.dispose();
      material.dispose();
    });

    test('disposes the material it built around a geometry handed in, and leaves the geometry alone', () => {
      const geometry = new FeatureSpritesGeometry(kind, 1);
      const geometryDispose = sandbox.spy(geometry, 'dispose');
      const sprites = new FeatureSprites(kind, {geometry});
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');

      sprites.dispose();

      expect([geometryDispose.called, materialDispose.calledOnce]).toEqual([false, true]);
      geometry.dispose();
    });

    test('takes the mesh out of the scene graph and fires the dispose event of three', () => {
      const scene = new Scene();
      const sprites = new FeatureSprites(kind);
      scene.add(sprites);
      let fired = 0;
      sprites.addEventListener('dispose', () => fired++);

      sprites.dispose();

      expect(sprites.parent).toBeNull();
      expect(fired).toBe(1);
    });

    test('gives up the geometry and the material references', () => {
      const sprites = new FeatureSprites(kind);

      sprites.dispose();

      expect([sprites.geometry, sprites.material]).toEqual([undefined, undefined]);
    });

    test('is safe to call twice', () => {
      const sprites = new FeatureSprites(kind);
      const geometryDispose = sandbox.spy(sprites.geometry!, 'dispose');

      expect(() => {
        sprites.dispose();
        sprites.dispose();
      }).not.toThrow();
      expect(geometryDispose.calledOnce).toBe(true);
    });

    test('does not leak signals or effects', () => {
      const signals = getSignalsCount();
      const effects = getEffectsCount();

      new FeatureSprites(kind, {textures: {colorMap: new Texture()}}).dispose();

      expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
    });

    test("a material put into the slot stays the caller's: dispose() releases the material the sprites built and leaves the other alone", () => {
      const sprites = new FeatureSprites(kind);
      const built = sprites.material!;
      const other = new FeatureSpritesMaterial(kind);
      const builtDispose = sandbox.spy(built, 'dispose');
      const otherDispose = sandbox.spy(other, 'dispose');
      sprites.material = other;

      sprites.dispose();

      expect([builtDispose.callCount, otherDispose.callCount]).toEqual([1, 0]);
      expect(sprites.material).toBeUndefined();
      other.dispose();
    });

    test("a geometry put into the slot stays the caller's: dispose() releases the geometry the sprites built", () => {
      const sprites = new FeatureSprites(kind);
      const built = sprites.geometry!;
      const other = new FeatureSpritesGeometry(kind, {capacity: 4});
      const builtDispose = sandbox.spy(built, 'dispose');
      const otherDispose = sandbox.spy(other, 'dispose');
      sprites.geometry = other;

      sprites.dispose();

      expect([builtDispose.callCount, otherDispose.callCount]).toEqual([1, 0]);
      expect(sprites.geometry).toBeUndefined();
      other.dispose();
    });
  });
  describe('a constructor that throws', () => {
    test('leaves no geometry alive when the material it builds is refused', () => {
      const signals = getSignalsCount();
      const effects = getEffectsCount();
      const geometryDispose = sandbox.spy(FeatureSpritesGeometry.prototype, 'dispose');

      expect(() => new FeatureSprites(kind, {capacity: 4, placement: Tint})).toThrow(TypeError);
      expect(() => new FeatureSprites(kind, {capacity: 4, textures: {unknown: new Texture()}})).toThrow();

      expect(geometryDispose.callCount).toBe(2);
      expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
    });

    test('refuses a malformed placement option in its own name and leaves nothing built', () => {
      const signals = getSignalsCount();
      const effects = getEffectsCount();
      const geometryDispose = sandbox.spy(FeatureSpritesGeometry.prototype, 'dispose');
      const odd = {name: 'odd', placement: 5} as never;

      expect(() => new FeatureSprites(kind, {placement: odd})).toThrow(
        new TypeError('FeatureSprites: the placement of feature "odd" is no function'),
      );
      expect(() => new FeatureSprites(kind, {placement: odd, passes: [ShadowPass]})).toThrow(
        new TypeError('FeatureSprites: the placement of feature "odd" is no function'),
      );

      expect(geometryDispose.called).toBe(false);
      expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
    });

    test('leaves a geometry handed in alone when the material it builds is refused', () => {
      const geometry = new FeatureSpritesGeometry(kind, 1);
      const geometryDispose = sandbox.spy(geometry, 'dispose');

      expect(() => new FeatureSprites(kind, {geometry, placement: Tint})).toThrow(TypeError);

      expect(geometryDispose.called).toBe(false);
      geometry.dispose();
    });
  });

  describe('passes', () => {
    const shade = defineFeature({name: 'shade', uniforms: {shadeColor: [0, 0, 0, 1]}, color: {order: 150, transform: (c) => c}});
    const drop = defineFeature({name: 'drop', uniforms: {dropOffset: [1, -1, 0]}, mesh: {order: 100, transform: (p) => p}});
    const shadow = definePass({name: 'shadow', features: [drop, shade], renderOrder: -1, material: {transparent: true}});

    test('builds one child mesh per pass over the geometry of the sprites, with a material of its own', () => {
      const sprites = new FeatureSprites(kind, {passes: [shadow]});
      const pass = sprites.passes['shadow']!;

      expect(pass.parent).toBe(sprites);
      expect(pass.geometry).toBe(sprites.geometry);
      expect(pass.material).not.toBe(sprites.material);
      expect(pass.material.pass).toBe(shadow);
      expect([pass.renderOrder, pass.frustumCulled, pass.material.transparent]).toEqual([-1, false, true]);
      expect(pass.name).toBe('twopoint5d.FeatureSprites.shadow');
      sprites.dispose();
    });

    test('draws a pass without a renderOrder in the order of the sprites, and builds no pass without passes', () => {
      const sprites = new FeatureSprites(kind, {passes: [definePass({name: 'plain', features: []})]});

      expect(sprites.passes['plain']!.renderOrder).toBe(0);
      expect(new FeatureSprites(kind).passes).toEqual({});
      sprites.dispose();
    });

    test('shares uniforms and textures between the sprites and every pass', () => {
      const colorMap = new Texture();
      const sprites = new FeatureSprites(kind, {passes: [shadow], textures: {colorMap}});
      const pass = sprites.passes['shadow']!;

      expect(pass.material.resources).toBe(sprites.material!.resources);
      expect(pass.material.getTexture('colorMap')).toBe(colorMap);
      sprites.setUniform('shadeColor', 1, 0, 0, 1);
      expect((pass.material.uniforms['shadeColor']!.value as Vector4).toArray()).toEqual([1, 0, 0, 1]);
      sprites.dispose();
    });

    test('writes a placement swap into every pass material', () => {
      const sprites = new FeatureSprites(kind, {passes: [shadow]});

      sprites.placement = BillboardPlacement;

      expect(sprites.passes['shadow']!.material.placement).toBe(BillboardPlacement);
      sprites.dispose();
    });

    test('starts every pass material with the placement the sprites start with', () => {
      const sprites = new FeatureSprites(kind, {passes: [shadow], placement: BillboardPlacement});

      expect(sprites.passes['shadow']!.material.placement).toBe(BillboardPlacement);
      sprites.dispose();
    });

    test('keeps the placement of a pass that brings its own, at the start and through a swap', () => {
      const facing = defineFeature({name: 'facing', placement: (local) => local});
      const own = definePass({name: 'own', features: [facing]});
      const sprites = new FeatureSprites(kind, {passes: [shadow, own], placement: BillboardPlacement});

      expect(sprites.passes['own']!.material.placement).toBe(facing);
      sprites.placement = FlatPlacement;
      expect(sprites.passes['own']!.material.placement).toBe(facing);
      expect(sprites.passes['shadow']!.material.placement).toBe(FlatPlacement);
      sprites.dispose();
    });

    test('lets a placement the material of the sprites refuses reach no pass', () => {
      const sprites = new FeatureSprites(kind, {passes: [shadow]});

      expect(() => {
        sprites.placement = Tint;
      }).toThrow(TypeError);

      expect(sprites.passes['shadow']!.material.placement).toBe(FlatPlacement);
      sprites.dispose();
    });

    test('update() uploads the dynamic buffer once per frame, whatever the number of passes', () => {
      const reflection = definePass({name: 'reflection', features: []});
      const sprites = new FeatureSprites(kind, {capacity: 1, passes: [shadow, reflection]});
      sprites.createSprite();
      sprites.update();
      const attribute = sprites.geometry!.getAttribute('instancePosition') as unknown as {
        data?: {version: number};
        version: number;
      };
      const versionOf = () => attribute.data?.version ?? attribute.version;
      const before = versionOf();

      sprites.update();

      expect(versionOf()).toBe(before + 1);
      expect('update' in sprites.passes['shadow']!).toBe(false);
      sprites.dispose();
    });

    test('refuses two passes of one name, a pass next to a material handed in, and a uniform two features declare', () => {
      const material = new FeatureSpritesMaterial(kind);
      const clash = definePass({name: 'clash', features: [defineFeature({name: 'other', uniforms: {shadeColor: 0}})]});

      expect(() => new FeatureSprites(kind, {passes: [shadow, shadow]})).toThrow('FeatureSprites: two passes are named "shadow"');
      expect(() => new FeatureSprites(kind, {material, passes: [shadow]})).toThrow(
        'FeatureSprites: passes share the uniforms and textures of a material the sprites build; hand in no material with them',
      );
      expect(() => new FeatureSprites(kind, {passes: [shadow, clash]})).toThrow(
        'FeatureSprites: features "shade" and "other" both declare the uniform "shadeColor"',
      );
      material.dispose();
    });

    test('refuses a pass the kind cannot draw before it builds anything', () => {
      const geometryBuilt = sandbox.spy(FeatureSpritesGeometry.prototype, 'dispose');

      expect(() => new FeatureSprites(kind, {passes: [definePass({name: 'p', features: [], without: ['tnt']})]})).toThrow(
        'FeatureSprites: pass "p" leaves out feature "tnt", which the sprite kind does not hold',
      );
      expect(geometryBuilt.called).toBe(false);
    });

    test('refuses a pass built without definePass() whose feature brings data, before it builds anything', () => {
      const geometryBuilt = sandbox.spy(FeatureSpritesGeometry.prototype, 'dispose');
      const lifting = defineFeature({name: 'lifting', methods: {lift() {}}});

      expect(() => new FeatureSprites(kind, {passes: [{name: 'plain', features: [lifting]}]})).toThrow(
        new TypeError(
          'FeatureSprites: feature "lifting" of pass "plain" brings methods; a pass draws the data of the sprites and brings stages, uniforms and textures alone',
        ),
      );
      expect(geometryBuilt.called).toBe(false);
    });

    test('dispose() removes the pass meshes, releases their materials and the shared resources, and leaves a geometry handed in alone', () => {
      const geometry = new FeatureSpritesGeometry(kind, 1);
      const geometryDispose = sandbox.spy(geometry, 'dispose');
      const sprites = new FeatureSprites(kind, {geometry, passes: [shadow]});
      const pass = sprites.passes['shadow']!;
      const passMaterialDispose = sandbox.spy(pass.material, 'dispose');
      let fired = 0;
      pass.addEventListener('dispose', () => fired++);
      const {resources} = sprites.material!;

      sprites.dispose();

      expect([pass.parent, passMaterialDispose.calledOnce, fired, resources.isDisposed, geometryDispose.called]).toEqual([
        null,
        true,
        1,
        true,
        false,
      ]);
      expect(sprites.passes).toEqual({});
      geometry.dispose();
    });

    test('draws the animated sprites with the shadow and the reflection pass, all of them on one time', () => {
      const sprites = new FeatureSprites(AnimatedSpriteKind, {passes: [ShadowPass, ReflectionPass]});

      expect(sprites.passes['shadow']!.material.uniforms['time']).toBe(sprites.uniforms!['time']);
      expect(sprites.passes['reflection']!.material.uniforms['time']).toBe(sprites.uniforms!['time']);
      expect(() => sprites.dispose()).not.toThrow();
    });

    test('answers the pass meshes in a frozen record, before and after dispose()', () => {
      const sprites = new FeatureSprites(kind, {passes: [shadow]});

      expect(Object.isFrozen(sprites.passes)).toBe(true);
      sprites.dispose();
      expect(Object.isFrozen(sprites.passes)).toBe(true);
    });

    test('holds a pass named like a member of Object.prototype as any other, and releases it', () => {
      const signals = getSignalsCount();
      const effects = getEffectsCount();
      const proto = definePass({name: '__proto__', features: [drop]});
      const sprites = new FeatureSprites(kind, {passes: [proto, definePass({name: 'constructor', features: []})]});
      const pass = sprites.passes[proto.name]!;

      expect(Object.keys(sprites.passes)).toEqual(['__proto__', 'constructor']);
      expect(pass.material.pass).toBe(proto);
      sprites.placement = BillboardPlacement;
      expect(pass.material.placement).toBe(BillboardPlacement);

      sprites.dispose();

      expect([pass.parent, sprites.children.length]).toEqual([null, 0]);
      expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
    });

    test('does not leak signals or effects with passes', () => {
      const signals = getSignalsCount();
      const effects = getEffectsCount();

      new FeatureSprites(kind, {passes: [shadow], textures: {colorMap: new Texture()}}).dispose();

      expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
    });

    describe('a constructor that throws', () => {
      // the stage reads an attribute the kind does not hold, so the pass is refused only once its material is built
      const broken = definePass({
        name: 'broken',
        features: [
          defineFeature({name: 'peek', color: {order: 150, transform: (c, {attribute}) => mul(c, attribute<'vec4'>('nope'))}}),
        ],
      });
      const refusal = 'FeatureSpritesMaterial: feature "peek" reads the attribute "nope", which the sprite kind does not hold';

      test('releases the pass materials built so far, the material, the shared resources and the geometry it built when a pass material is refused', () => {
        const signals = getSignalsCount();
        const effects = getEffectsCount();
        const materialDispose = sandbox.spy(FeatureSpritesMaterial.prototype, 'dispose');
        const resourcesDispose = sandbox.spy(SpriteResources.prototype, 'dispose');
        const geometryDispose = sandbox.spy(FeatureSpritesGeometry.prototype, 'dispose');

        expect(() => new FeatureSprites(kind, {passes: [shadow, broken], textures: {colorMap: new Texture()}})).toThrow(refusal);

        // the material of the sprites and the one of the shadow; the refused one released itself
        expect([materialDispose.callCount, resourcesDispose.callCount, geometryDispose.callCount]).toEqual([2, 1, 1]);
        expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
      });

      test('leaves a geometry handed in alone when a pass material is refused', () => {
        const geometry = new FeatureSpritesGeometry(kind, 1);
        const geometryDispose = sandbox.spy(geometry, 'dispose');

        expect(() => new FeatureSprites(kind, {geometry, passes: [broken]})).toThrow(refusal);

        expect(geometryDispose.called).toBe(false);
        geometry.dispose();
      });

      test('releases the shared resources and the geometry it built when the material of the sprites is refused', () => {
        const signals = getSignalsCount();
        const effects = getEffectsCount();
        const resourcesDispose = sandbox.spy(SpriteResources.prototype, 'dispose');
        const geometryDispose = sandbox.spy(FeatureSpritesGeometry.prototype, 'dispose');

        expect(() => new FeatureSprites(kind, {passes: [shadow], placement: Tint, textures: {colorMap: new Texture()}})).toThrow(
          TypeError,
        );

        expect([resourcesDispose.callCount, geometryDispose.callCount]).toEqual([1, 1]);
        expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
      });

      test('releases the geometry it built when the shared resources are refused', () => {
        const signals = getSignalsCount();
        const effects = getEffectsCount();
        const geometryDispose = sandbox.spy(FeatureSpritesGeometry.prototype, 'dispose');

        expect(() => new FeatureSprites(kind, {passes: [shadow], textures: {unknown: new Texture()}})).toThrow(
          'FeatureSprites: no feature declares the texture "unknown"',
        );

        expect(geometryDispose.callCount).toBe(1);
        expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
      });
    });

    describe('uniformNames', () => {
      const moonShadow = definePass({
        ...ShadowPass,
        name: 'moonShadow',
        uniformNames: {groundPlane: 'moonGround', shadowLight: 'moonLight', shadowColor: 'moonShadowColor'},
      });

      test('declares the uniforms of a renamed copy next to those of the pass, at the start values of the feature', () => {
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, moonShadow]});
        const value = (name: string) => (sprites.uniforms![name]!.value as Vector4).toArray();

        expect(value('moonLight')).toEqual([-0.4, 1, -0.3, 0]);
        expect(value('moonGround')).toEqual([0, 1, 0, 0]);
        sprites.setUniform('moonLight', 0, 10, 0, 1);
        expect(value('shadowLight')).toEqual([-0.4, 1, -0.3, 0]);
        sprites.dispose();
      });

      test('builds the material of the copy from the renamed uniforms, not the originals', () => {
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, moonShadow]});
        const nodes = nodesOf(sprites.passes['moonShadow']!.material.positionNode!);
        const {uniforms} = sprites;

        expect(nodes.has(uniforms!['moonGround']!)).toBe(true);
        expect(nodes.has(uniforms!['moonLight']!)).toBe(true);
        expect(nodes.has(uniforms!['groundPlane']!)).toBe(false);
        expect(nodesOf(sprites.passes['shadow']!.material.positionNode!).has(uniforms!['groundPlane']!)).toBe(true);
        sprites.dispose();
      });

      test('starts a renamed uniform from the options under its new name', () => {
        const sprites = new FeatureSprites(kind, {passes: [moonShadow], uniforms: {moonShadowColor: [0, 0, 1, 0.3]}});

        expect((sprites.uniforms!['moonShadowColor']!.value as Vector4).toArray()).toEqual([0, 0, 1, 0.3]);
        sprites.dispose();
      });

      test('two renamed copies, the reflection and the time of an animated kind live side by side', () => {
        const sunset = definePass({
          ...ShadowPass,
          name: 'sunset',
          uniformNames: {shadowLight: 'sunsetLight', groundPlane: 'sunsetGround', shadowColor: 'sunsetColor'},
        });
        const sprites = new FeatureSprites(AnimatedSpriteKind, {passes: [ShadowPass, moonShadow, sunset, ReflectionPass]});

        expect(Object.keys(sprites.passes)).toEqual(['shadow', 'moonShadow', 'sunset', 'reflection']);
        expect(sprites.uniforms!['time']).toBeDefined();
        expect(sprites.uniforms!['sunsetLight']).not.toBe(sprites.uniforms!['moonLight']);
        sprites.dispose();
      });

      test('refuses a target that collides with a uniform of the kind', () => {
        const clash = definePass({...ShadowPass, name: 'clash', uniformNames: {shadowLight: 'time'}});

        expect(() => new FeatureSprites(AnimatedSpriteKind, {passes: [clash]})).toThrow(/both declare the uniform "time"/);
      });

      test('refuses two renamed copies that rename two different uniforms of one feature to one name', () => {
        const byLight = definePass({...ShadowPass, name: 'byLight', uniformNames: {shadowLight: 'moon'}});
        const byGround = definePass({...ShadowPass, name: 'byGround', uniformNames: {groundPlane: 'moon'}});

        expect(() => new FeatureSprites(kind, {passes: [byLight, byGround]})).toThrow(
          'FeatureSprites: features "planarShadow" and "planarShadow" both declare the uniform "moon"',
        );
      });

      test('a plain copy without uniformNames shares the uniforms of the pass it copies', () => {
        const twin = definePass({...ShadowPass, name: 'twin'});
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, twin]});
        const {uniforms} = sprites;

        expect(nodesOf(sprites.passes['twin']!.material.positionNode!).has(uniforms!['groundPlane']!)).toBe(true);
        sprites.dispose();
      });
    });

    describe('visible and enabled', () => {
      test('update() shows a pass while its hook agrees and hides it otherwise', () => {
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, ReflectionPass]});
        const shadowMesh = sprites.passes['shadow']!;

        sprites.update();
        expect(shadowMesh.visible).toBe(true);
        sprites.setUniform('shadowLight', 0.4, -1, 0.3, 0); // from below
        sprites.update();
        expect(shadowMesh.visible).toBe(false);
        expect(sprites.passes['reflection']!.visible).toBe(true);
        sprites.dispose();
      });

      test('a pass switched off stays hidden through update() while the hook agrees, and follows it once switched on', () => {
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
        const shadowMesh = sprites.passes['shadow']!;

        expect(shadowMesh.enabled).toBe(true);
        shadowMesh.enabled = false;
        expect(shadowMesh.enabled).toBe(false);
        sprites.update();
        sprites.update();
        expect(shadowMesh.visible).toBe(false);
        shadowMesh.enabled = true;
        expect(shadowMesh.visible).toBe(true);
        sprites.setUniform('shadowLight', 0.4, -1, 0.3, 0);
        sprites.update();
        shadowMesh.enabled = true;
        expect(shadowMesh.visible).toBe(false);
        sprites.dispose();
      });

      test('the hook of a renamed copy judges the renamed uniforms', () => {
        const moon = definePass({
          ...ShadowPass,
          name: 'moon',
          uniformNames: {shadowLight: 'moonLight', groundPlane: 'moonGround', shadowColor: 'moonColor'},
        });
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, moon]});

        sprites.setUniform('moonLight', 0, -1, 0, 1);
        sprites.update();
        expect([sprites.passes['shadow']!.visible, sprites.passes['moon']!.visible]).toEqual([true, false]);
        sprites.dispose();
      });

      test('the lookup of a hook throws from update() for a name that is no uniform of the sprites, and resolves one of the kind', () => {
        const peek = (name: string): SpritePass =>
          definePass({name: `peek-${name}`, features: [], visible: (uniform) => uniform(name) != null});
        const sprites = new FeatureSprites(AnimatedSpriteKind, {passes: [peek('time')]});
        const unknown = new FeatureSprites(kind, {passes: [peek('nothing')]});
        const inherited = new FeatureSprites(kind, {passes: [peek('constructor')]});

        sprites.update();
        expect(sprites.passes['peek-time']!.visible).toBe(true);
        expect(() => unknown.update()).toThrow(
          'FeatureSprites: the visible of pass "peek-nothing" reads the uniform "nothing", which no feature of these sprites declares',
        );
        expect(() => inherited.update()).toThrow(
          'FeatureSprites: the visible of pass "peek-constructor" reads the uniform "constructor", which no feature of these sprites declares',
        );
        sprites.dispose();
        unknown.dispose();
        inherited.dispose();
      });

      test('a pass without a hook follows enabled alone', () => {
        const sprites = new FeatureSprites(kind, {passes: [ReflectionPass]});
        const mesh = sprites.passes['reflection']!;

        mesh.enabled = false;
        sprites.update();
        expect(mesh.visible).toBe(false);
        mesh.enabled = true;
        expect(mesh.visible).toBe(true);
        sprites.dispose();
      });
    });
  });

  describe('bindUniform()', () => {
    const vec = (sprites: Pick<FeatureSprites, 'uniforms'>, name: string) =>
      (sprites.uniforms![name]!.value as Vector4).toArray();
    const ground = () => {
      const mesh = new Mesh(new PlaneGeometry(4, 4));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 2;
      return mesh;
    };

    test('update() writes the bound uniform in the local space of the sprites, for the sprites and every pass', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      sprites.position.y = 5;
      sprites.bindUniform('groundPlane', planeOf(ground()));

      sprites.update();

      // the ground at y = 2 lies at y = -3 for the sprites at y = 5
      const [x, y, z, d] = vec(sprites, 'groundPlane');
      expect(x).toBeCloseTo(0, 5);
      expect(z).toBeCloseTo(0, 5);
      expect(d! / y!).toBeCloseTo(-3, 5);
      expect(sprites.passes['shadow']!.material.uniforms['groundPlane']!.value).toBe(sprites.uniforms!['groundPlane']!.value);
      sprites.dispose();
    });

    test('reads the sprites where they are: a parent moved without updateMatrixWorld()', () => {
      const parent = new Object3D();
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      parent.add(sprites);
      parent.updateMatrixWorld();
      parent.position.y = 2;
      sprites.bindUniform('groundPlane', planeOf(ground()));

      sprites.update();

      const [, y, , d] = vec(sprites, 'groundPlane');
      expect(d! / y!).toBeCloseTo(0, 5);
      sprites.dispose();
    });

    test('binds a light and overwrites a setUniform() on a bound name in the next update()', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      const lamp = new PointLight();
      lamp.position.set(1, 8, -2);
      sprites.bindUniform('shadowLight', lightOf(lamp));

      sprites.setUniform('shadowLight', 0, 1, 0, 0);
      sprites.update();

      expect(vec(sprites, 'shadowLight')).toEqual([1, 8, -2, 1]);
      sprites.dispose();
    });

    test('a rebinding replaces the source, unbindUniform() keeps the last value', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      const a = new Object3D();
      const b = new Object3D();
      b.position.set(0, 3, 0);
      sprites.bindUniform('shadowLight', lightOf(a));
      sprites.bindUniform('shadowLight', lightOf(b));
      sprites.update();
      expect(vec(sprites, 'shadowLight')).toEqual([0, 3, 0, 1]);

      sprites.unbindUniform('shadowLight');
      b.position.set(0, 9, 0);
      sprites.update();
      expect(vec(sprites, 'shadowLight')).toEqual([0, 3, 0, 1]);
      sprites.dispose();
    });

    test('binds a renamed uniform of a copy of a pass under its new name, and update() writes it', () => {
      const moon = definePass({...ShadowPass, name: 'moon', uniformNames: {shadowLight: 'moonLight'}});
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass, moon]});
      const lamp = new Object3D();
      lamp.position.set(2, 6, 1);
      sprites.bindUniform('moonLight', lightOf(lamp));

      sprites.update();

      expect(vec(sprites, 'moonLight')).toEqual([2, 6, 1, 1]);
      expect(vec(sprites, 'shadowLight')).toEqual([-0.4, 1, -0.3, 0]);
      expect(nodesOf(sprites.passes['moon']!.material.positionNode!).has(sprites.uniforms!['moonLight']!)).toBe(true);
      sprites.dispose();
    });

    test('refuses an unknown name, a source of another type and no source, and binds nothing then', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      const vec3Source = {type: 'vec3' as const, write: () => {}};

      expect(() => sprites.bindUniform('nothing', planeOf(ground()))).toThrow(
        'FeatureSprites: no feature of these sprites or their passes declares the uniform "nothing"',
      );
      expect(() => sprites.bindUniform('groundPlane', vec3Source)).toThrow(
        'FeatureSprites: the uniform "groundPlane" is a vec4, and the source bound to it writes a vec3',
      );
      expect(() => sprites.bindUniform('groundPlane', {} as never)).toThrow(
        'FeatureSprites: bindUniform("groundPlane") takes a source with a type of vec3 or vec4 and a write()',
      );
      sprites.setUniform('groundPlane', 0, 0, 1, 7);
      sprites.update();
      expect(vec(sprites, 'groundPlane')).toEqual([0, 0, 1, 7]);
      sprites.dispose();
    });

    test('evaluates the bindings before the hooks: a light bound below the ground hides the shadow in the same update()', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      const lamp = new Object3D();
      lamp.position.set(0, -4, 0);
      sprites.bindUniform('shadowLight', lightOf(lamp));

      sprites.update();

      expect(sprites.passes['shadow']!.visible).toBe(false);
      sprites.dispose();
    });

    test('dispose() drops the bindings; binding afterwards does nothing', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      sprites.bindUniform('groundPlane', planeOf(ground()));
      sprites.dispose();

      expect(() => sprites.bindUniform('groundPlane', planeOf(ground()))).not.toThrow();
      expect(() => sprites.unbindUniform('groundPlane')).not.toThrow();
      expect(() => sprites.update()).not.toThrow();
    });

    test('names the type of a float, a vec2 and a vec3 uniform, and binds a vec3 source of its own', () => {
      const levels = definePass({
        name: 'levels',
        features: [defineFeature({name: 'levels', uniforms: {level: 1, offset: [1, 2], lift: [0, 1, 0]}})],
      });
      const sprites = new FeatureSprites(kind, {passes: [levels]});
      const vec4Source = {type: 'vec4' as const, write: () => {}};
      const lift: SpriteUniformSource = {
        type: 'vec3',
        write(out) {
          out.x = 2;
          out.y = 4;
          out.z = 8;
        },
      };

      expect(() => sprites.bindUniform('level', vec4Source)).toThrow(
        'FeatureSprites: the uniform "level" is a float, and the source bound to it writes a vec4',
      );
      expect(() => sprites.bindUniform('offset', vec4Source)).toThrow(
        'FeatureSprites: the uniform "offset" is a vec2, and the source bound to it writes a vec4',
      );
      expect(() => sprites.bindUniform('lift', vec4Source)).toThrow(
        'FeatureSprites: the uniform "lift" is a vec3, and the source bound to it writes a vec4',
      );
      sprites.bindUniform('lift', lift);
      sprites.update();
      expect((sprites.uniforms!['lift']!.value as Vector3).toArray()).toEqual([2, 4, 8]);
      sprites.dispose();
    });
  });

  describe('update() behind code of the caller that throws', () => {
    const thrown = (run: () => void): Error => {
      try {
        run();
      } catch (error) {
        return error as Error;
      }
      throw new Error('nothing was thrown');
    };
    const throwingSource = (message: string): SpriteUniformSource => ({
      type: 'vec4',
      write() {
        throw new Error(message);
      },
    });
    const below = () => {
      const lamp = new Object3D();
      lamp.position.set(0, -4, 0);
      return lamp;
    };

    test('update() uploads what the pools marked when the visible hook of a pass throws, and names the pass', () => {
      const cause = new Error('the hook broke');
      const boom = definePass({
        name: 'boom',
        features: [],
        visible: () => {
          throw cause;
        },
      });
      const sprites = new FeatureSprites(kind, {capacity: 4, passes: [boom]});
      sprites.createSprite();
      sprites.createSprite();
      const upload = sandbox.spy(sprites.geometry!, 'update');

      const error = thrown(() => sprites.update());

      expect(error.message).toBe('FeatureSprites: the visible of pass "boom" threw: the hook broke');
      expect(error.cause).toBe(cause);
      expect(upload.callCount).toBe(1);
      expect(sprites.geometry!.instanceCount).toBe(2);
      sprites.dispose();
    });

    test('update() writes the other bindings and judges every pass behind a source that throws', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      sprites.bindUniform('groundPlane', throwingSource('the source broke'));
      sprites.bindUniform('shadowLight', lightOf(below()));
      const upload = sandbox.spy(sprites.geometry!, 'update');

      const error = thrown(() => sprites.update());

      expect(error.message).toBe('FeatureSprites: the source bound to the uniform "groundPlane" threw: the source broke');
      expect((sprites.uniforms!['shadowLight']!.value as Vector4).toArray()).toEqual([0, -4, 0, 1]);
      expect(sprites.passes['shadow']!.visible).toBe(false);
      expect(upload.callCount).toBe(1);
      sprites.dispose();
    });

    test('update() throws an AggregateError when more than one source or hook threw', () => {
      const boom = definePass({
        name: 'boom',
        features: [],
        visible: () => {
          throw 'the hook broke';
        },
      });
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass, boom]});
      sprites.bindUniform('groundPlane', throwingSource('the source broke'));

      const error = thrown(() => sprites.update());

      expect(error).toBeInstanceOf(AggregateError);
      expect(error.message).toBe('FeatureSprites#update(): more than one bound source or visible hook threw');
      expect((error as AggregateError).errors.map(({message}: Error) => message)).toEqual([
        'FeatureSprites: the source bound to the uniform "groundPlane" threw: the source broke',
        'FeatureSprites: the visible of pass "boom" threw: the hook broke',
      ]);
      sprites.dispose();
    });

    test('a pass whose hook throws keeps the visibility of its last judgement', () => {
      let verdict: boolean | 'throw' = false;
      const moody = definePass({
        name: 'moody',
        features: [],
        visible: () => {
          if (verdict === 'throw') throw new Error('no verdict');
          return verdict;
        },
      });
      const sprites = new FeatureSprites(kind, {passes: [moody]});
      const mesh = sprites.passes['moody']!;

      sprites.update();
      expect(mesh.visible).toBe(false);
      verdict = 'throw';
      expect(() => sprites.update()).toThrow('FeatureSprites: the visible of pass "moody" threw: no verdict');
      expect(mesh.visible).toBe(false);
      mesh.enabled = true;
      expect(mesh.visible).toBe(false);

      verdict = true;
      sprites.update();
      expect(mesh.visible).toBe(true);
      verdict = 'throw';
      expect(() => sprites.update()).toThrow();
      expect(mesh.visible).toBe(true);
      sprites.dispose();
    });

    test('a hook that asks uniform() for an undeclared name throws that refusal as it is', () => {
      const peek = definePass({name: 'peek', features: [], visible: (uniform) => uniform('nothing') != null});
      const sprites = new FeatureSprites(kind, {passes: [peek]});
      const upload = sandbox.spy(sprites.geometry!, 'update');

      const error = thrown(() => sprites.update());

      expect(error.message).toBe(
        'FeatureSprites: the visible of pass "peek" reads the uniform "nothing", which no feature of these sprites declares',
      );
      expect(upload.callCount).toBe(1);
      sprites.dispose();
    });
  });

  describe('another material in the slot', () => {
    const glow = defineFeature({name: 'glow', uniforms: {glowColor: [0, 0, 0, 1]}, color: {order: 150, transform: (c) => c}});
    const glowing = defineSprite({
      base: QuadBase,
      features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint, glow],
    });

    test('while another material sits in the slot, setUniform(), setTexture() and a binding reach the material of the sprites and every pass', () => {
      const sprites = new FeatureSprites(glowing, {passes: [ShadowPass]});
      const own = sprites.material!;
      const pass = sprites.passes['shadow']!.material;
      const other = new FeatureSpritesMaterial(glowing);
      const colorMap = new Texture();
      sprites.material = other;

      sprites.setUniform('glowColor', 1, 0.5, 0.25, 1);
      sprites.setTexture('colorMap', colorMap);
      sprites.bindUniform('groundPlane', {type: 'vec4', write: (v) => v.set(0, 1, 0, 2)});
      sprites.update();

      for (const material of [own, pass]) {
        expect((material.uniforms['glowColor']!.value as Vector4).toArray()).toEqual([1, 0.5, 0.25, 1]);
        expect((material.uniforms['groundPlane']!.value as Vector4).toArray()).toEqual([0, 1, 0, 2]);
        expect(material.getTexture('colorMap')).toBe(colorMap);
      }
      expect((other.uniforms['glowColor']!.value as Vector4).toArray()).toEqual([0, 0, 0, 1]);
      expect(Object.hasOwn(other.uniforms, 'groundPlane')).toBe(false);
      expect(other.getTexture('colorMap')).toBeUndefined();
      expect([sprites.uniforms, sprites.getTexture('colorMap')]).toEqual([own.uniforms, colorMap]);
      sprites.dispose();
      other.dispose();
    });
  });

  describe('another geometry in the slot', () => {
    test('every pass mesh draws a geometry put into the slot, and the geometry put back', () => {
      const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 2, passes: [ShadowPass, ReflectionPass]});
      const built = sprites.geometry!;
      const other = new FeatureSpritesGeometry(TexturedSpriteKind, 4);

      sprites.geometry = other;
      expect(sprites.geometry).toBe(other);
      for (const mesh of Object.values(sprites.passes)) expect(mesh.geometry).toBe(other);

      sprites.geometry = built;
      for (const mesh of Object.values(sprites.passes)) expect(mesh.geometry).toBe(built);

      sprites.dispose();
      other.dispose();
    });

    test('createSprite(), freeSprite(), sortBy() and spritePool work on the pool of the geometry the passes draw', () => {
      const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 2, passes: [ShadowPass]});
      const other = new FeatureSpritesGeometry(TexturedSpriteKind, 4);
      sprites.geometry = other;

      const a = sprites.createSprite()!;
      const b = sprites.createSprite()!;
      a.setPosition(0, 2, 0);
      b.setPosition(0, 1, 0);

      expect(sprites.spritePool).toBe(other.instancedPool);
      expect(other.instancedPool.usedCount).toBe(2);
      expect(sprites.sortBy('y')).toBe(true);
      expect(other.instancedPool.getVO(0)).toBe(b);
      sprites.freeSprite(a);
      expect(other.instancedPool.usedCount).toBe(1);
      expect(sprites.passes['shadow']!.geometry).toBe(other);

      sprites.dispose();
      other.dispose();
    });

    test('sortByViewDepth() sorts the pool of a geometry put into the slot, past the capacity the sprites were built with', () => {
      const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 2, passes: [ShadowPass]});
      const built = sprites.geometry!;
      const other = new FeatureSpritesGeometry(TexturedSpriteKind, 4);
      sprites.geometry = other;
      const [a, b, c] = [0, -5, -2].map((z) => {
        const sprite = sprites.createSprite()!;
        sprite.setPosition(0, 0, z);
        return sprite;
      });
      // looks along -z: the farthest sprite has the lowest view depth and is drawn first
      const camera = new PerspectiveCamera();
      camera.position.set(0, 0, 10);
      const movesBefore = other.instancedPool.slotMoves;

      expect(sprites.sortByViewDepth(camera)).toBe(true);

      expect(other.instancedPool.getVO(0)).toBe(b);
      expect(other.instancedPool.getVO(1)).toBe(c);
      expect(other.instancedPool.getVO(2)).toBe(a);
      expect(other.instancedPool.slotMoves).toBeGreaterThan(movesBefore);
      expect(sprites.passes['shadow']!.geometry).toBe(other);
      expect(built.instancedPool.usedCount).toBe(0);

      sprites.dispose();
      other.dispose();
    });
  });
});
