import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {mul} from 'three/tsl';
import type {MeshBasicMaterial, Vector4} from 'three/webgpu';
import {Scene, Texture} from 'three/webgpu';
import {afterEach, describe, expect, expectTypeOf, test} from 'vitest';

import {defineSprite} from '../defineSprite.js';
import {AtlasFrame} from '../features/AtlasFrame.js';
import {BillboardPlacement} from '../features/BillboardPlacement.js';
import {FlatPlacement} from '../features/FlatPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {QuadSize} from '../features/QuadSize.js';
import {Rotation} from '../features/Rotation.js';
import {TextureColor} from '../features/TextureColor.js';
import {Tint} from '../features/Tint.js';
import {definePass, type SpritePass} from '../passes/definePass.js';
import {QuadBase} from '../SpriteBase.js';
import {defineFeature} from '../SpriteFeature.js';
import {FeatureSprites} from './FeatureSprites.js';
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
    const sprites = new FeatureSprites(kind, {capacity: 1});
    const sprite = sprites.createSprite()!;

    expect(sprites.spritePool!.usedCount).toBe(1);
    expect(sprites.createSprite()).toBeUndefined();
    sprites.freeSprite(sprite);
    expect(sprites.spritePool!.usedCount).toBe(0);
    expectTypeOf(sprite).toHaveProperty('setFrame');
    sprites.dispose();
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
  });
});
