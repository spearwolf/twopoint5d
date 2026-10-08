import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {add, vec3, vec4} from 'three/tsl';
import type {MeshBasicMaterial, Node, VaryingNode} from 'three/webgpu';
import {AdditiveBlending, NearestFilter, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {attributeNamesOf, operatorOf, samplesTexture, textureNodesOf} from '../../testing/spriteGraph.js';
import {defineSprite} from '../defineSprite.js';
import {AtlasFrame} from '../features/AtlasFrame.js';
import {BillboardPlacement} from '../features/BillboardPlacement.js';
import {FlatPlacement} from '../features/FlatPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {QuadSize} from '../features/QuadSize.js';
import {Rotation} from '../features/Rotation.js';
import {TextureColor} from '../features/TextureColor.js';
import {Tint} from '../features/Tint.js';
import {QuadBase} from '../SpriteBase.js';
import {definePass} from '../passes/definePass.js';
import {defineFeature, type SpriteFeature} from '../SpriteFeature.js';
import {SpriteResources} from './SpriteResources.js';
import {FeatureSpritesMaterial} from './FeatureSpritesMaterial.js';

const TexturedKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint],
});
const PlainKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize]});

const calls: string[] = [];
const recorder = (name: string, slot: 'local' | 'mesh' | 'color', order: number): SpriteFeature =>
  defineFeature({
    name,
    [slot]: {
      order,
      transform: (input: Node) => {
        calls.push(name);
        return input;
      },
    },
  } as unknown as SpriteFeature);
// a recorder that declares a texture of its own and so waits for it
const waiting = (name: string, slot: 'local' | 'mesh' | 'color', order: number): SpriteFeature =>
  defineFeature({...recorder(name, slot, order), textures: {[`${name}Map`]: {}}});
const recordingPlacement = defineFeature({
  name: 'recordingPlacement',
  requires: ['instancePosition'],
  placement: (local, {attribute}) => {
    calls.push('placement');
    return add(local, attribute<'vec3'>('instancePosition'));
  },
});

// a frame feature that waits for the image of a lookup texture, as AnimatedFrames does
const lookupFrame = defineFeature({
  name: 'lookupFrame',
  textures: {lookup: {needsImage: true}},
  frame: ({sample, attribute}) => {
    const texel = sample('lookup', attribute<'vec2'>('uv'));
    return {texCoords: texel, trim: texel};
  },
});
const LookupKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, lookupFrame, TextureColor]});

const withImage = (width = 4, height = 4) => {
  const texture = new Texture();
  texture.image = {width, height} as unknown as HTMLImageElement;
  return texture;
};

describe('FeatureSpritesMaterial', () => {
  const sandbox = createSandbox();
  afterEach(() => {
    sandbox.restore();
    calls.length = 0;
  });

  test('takes a kind and its parameters, no three.js material and no texture (a type-level check)', () => {
    const withMaterial = (material: MeshBasicMaterial) =>
      // @ts-expect-error the parameters of a FeatureSpritesMaterial only
      new FeatureSpritesMaterial(TexturedKind, material);
    const withTexture = (texture: Texture) =>
      // @ts-expect-error the parameters of a FeatureSpritesMaterial only
      new FeatureSpritesMaterial(TexturedKind, texture);
    void withMaterial;
    void withTexture;
  });

  describe('parameters', () => {
    test('applies the three.js material parameters it is given', () => {
      const material = new FeatureSpritesMaterial(TexturedKind, {
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });

      expect([material.transparent, material.depthWrite, material.blending]).toEqual([true, false, AdditiveBlending]);
      material.dispose();
    });

    test('keeps its own options apart from them', () => {
      const warn = sandbox.spy(console, 'warn');
      const colorMap = new Texture();

      const material = new FeatureSpritesMaterial(TexturedKind, {
        name: 'sprites',
        textures: {colorMap},
        uniforms: {},
        transparent: true,
      });

      expect(material.name).toBe('sprites');
      expect(material.getTexture('colorMap')).toBe(colorMap);
      expect(material.transparent).toBe(true);
      expect(warn.called).toBe(false);
      expect(material.isFeatureSpritesMaterial).toBe(true);
      expect(material.kind).toBe(TexturedKind);
      material.dispose();
    });

    test('is named twopoint5d.FeatureSpritesMaterial without a name', () => {
      const material = new FeatureSpritesMaterial(PlainKind);

      expect(material.name).toBe('twopoint5d.FeatureSpritesMaterial');
      material.dispose();
    });

    test('drops fully transparent texels by default, and leaves the alpha test to an alphaTest it is given', () => {
      const byDefault = new FeatureSpritesMaterial(TexturedKind);
      const withAlphaTest = new FeatureSpritesMaterial(TexturedKind, {alphaTest: 0.5});

      expect(byDefault.alphaTestNode).not.toBeNull();
      expect(withAlphaTest.alphaTest).toBe(0.5);
      expect(withAlphaTest.alphaTestNode).toBeNull();
      byDefault.dispose();
      withAlphaTest.dispose();
    });

    test('refuses resources together with textures or uniforms', () => {
      const resources = new SpriteResources(TexturedKind.features);
      const baseline = [getSignalsCount(), getEffectsCount()];

      expect(() => new FeatureSpritesMaterial(TexturedKind, {resources, textures: {colorMap: new Texture()}})).toThrow(
        'FeatureSpritesMaterial: textures and uniforms belong to the resources handed in',
      );
      expect([getSignalsCount(), getEffectsCount()]).toEqual(baseline);
      resources.dispose();
    });

    test('refuses resources that miss a declaration of the kind', () => {
      const resources = new SpriteResources(PlainKind.features);
      const baseline = [getSignalsCount(), getEffectsCount()];

      expect(() => new FeatureSpritesMaterial(TexturedKind, {resources})).toThrow(
        'FeatureSpritesMaterial: the resources handed in lack what feature "textureColor" declares',
      );
      expect([getSignalsCount(), getEffectsCount()]).toEqual(baseline);
      expect(resources.isDisposed).toBe(false);
      resources.dispose();
    });

    test('refuses resources that have been disposed', () => {
      const resources = new SpriteResources(TexturedKind.features);
      resources.dispose();
      const baseline = [getSignalsCount(), getEffectsCount()];

      expect(() => new FeatureSpritesMaterial(TexturedKind, {resources})).toThrow(
        new TypeError('FeatureSpritesMaterial: the resources handed in have been disposed'),
      );
      expect([getSignalsCount(), getEffectsCount()]).toEqual(baseline);
    });
  });

  describe('the position graph', () => {
    test('adds the instance position last, flat by default', () => {
      const material = new FeatureSpritesMaterial(TexturedKind);

      const position = operatorOf(material.positionNode);
      expect(position.op).toBe('+');
      expect(attributeNamesOf(position.bNode as Node)).toEqual(['instancePosition']);
      expect(material.placement).toBe(FlatPlacement);
      material.dispose();
    });

    test('reads the base position and uv, the trim, the size and the rotation', () => {
      const material = new FeatureSpritesMaterial(TexturedKind);

      expect(new Set(attributeNamesOf(material.positionNode!))).toEqual(
        new Set(['position', 'uv', 'texTrim', 'quadSize', 'rotation', 'instancePosition']),
      );
      material.dispose();
    });

    test('shifts nothing without a frame that has trim margins', () => {
      const material = new FeatureSpritesMaterial(PlainKind);

      expect(attributeNamesOf(material.positionNode!)).not.toContain('uv');
      material.dispose();
    });

    test('runs the local stages by order, then the placement, then the mesh stages by order', () => {
      const kind = defineSprite({
        base: QuadBase,
        features: [
          InstancePosition,
          recordingPlacement,
          recorder('mesh2', 'mesh', 300),
          recorder('local2', 'local', 400),
          recorder('mesh1', 'mesh', 100),
          recorder('local1', 'local', 200),
        ],
      });

      const material = new FeatureSpritesMaterial(kind);

      expect(calls).toEqual(['local1', 'local2', 'placement', 'mesh1', 'mesh2']);
      material.dispose();
    });

    test('leaves out a local, a mesh or a color stage until the texture it declares is set', () => {
      const kind = defineSprite({
        base: QuadBase,
        features: [
          InstancePosition,
          recordingPlacement,
          waiting('wobble', 'local', 300),
          waiting('mirror', 'mesh', 300),
          waiting('mask', 'color', 150),
        ],
      });
      const material = new FeatureSpritesMaterial(kind);

      expect(calls).toEqual(['placement']);
      for (const [textureName, rebuilt] of [
        ['wobbleMap', ['wobble', 'placement']],
        ['mirrorMap', ['wobble', 'placement', 'mirror']],
        ['maskMap', ['mask']],
      ] as const) {
        calls.length = 0;
        material.setTexture(textureName, new Texture());
        expect(calls, textureName).toEqual(rebuilt);
      }
      material.dispose();
    });

    test('throws, naming the feature and the attribute, for a stage that reads an attribute the kind does not hold', () => {
      const typo = defineFeature({
        name: 'typo',
        local: {order: 250, transform: (p, {attribute}) => add(p, attribute<'vec3'>('instancePositon'))},
      });
      const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, typo]});
      const baseline = [getSignalsCount(), getEffectsCount()];

      expect(() => new FeatureSpritesMaterial(kind)).toThrow(
        'FeatureSpritesMaterial: feature "typo" reads the attribute "instancePositon", which the sprite kind does not hold',
      );
      expect([getSignalsCount(), getEffectsCount()]).toEqual(baseline);
    });

    test('throws for a frame stage that reads an attribute the kind does not hold, and leaves nothing behind', () => {
      const typo = defineFeature({name: 'typoFrame', frame: ({attribute}) => ({texCoords: attribute<'vec4'>('texCoord')})});
      const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, typo]});
      const baseline = [getSignalsCount(), getEffectsCount()];

      expect(() => new FeatureSpritesMaterial(kind)).toThrow(
        'FeatureSpritesMaterial: feature "typoFrame" reads the attribute "texCoord", which the sprite kind does not hold',
      );
      expect([getSignalsCount(), getEffectsCount()]).toEqual(baseline);
    });

    test('throws for a stage that reads a uniform no feature declares, or samples a texture of another feature', () => {
      const uniformReader = defineFeature({
        name: 'uniformReader',
        local: {order: 250, transform: (p, {uniform}) => add(p, uniform<'vec3'>('wind'))},
      });
      const sampler = defineFeature({
        name: 'sampler',
        color: {order: 250, transform: (_color, {sample, attribute}) => sample('colorMap', attribute<'vec2'>('uv'))},
      });
      const baseline = [getSignalsCount(), getEffectsCount()];

      expect(
        () =>
          new FeatureSpritesMaterial(defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, uniformReader]})),
      ).toThrow(
        'FeatureSpritesMaterial: feature "uniformReader" reads the uniform "wind", which no feature of these sprites declares',
      );
      expect(
        () =>
          new FeatureSpritesMaterial(
            defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, TextureColor, sampler]}),
          ),
      ).toThrow('FeatureSpritesMaterial: feature "sampler" reads the texture "colorMap", which it does not declare');
      expect([getSignalsCount(), getEffectsCount()]).toEqual(baseline);
    });
  });

  describe('the placement', () => {
    test('builds a billboard graph once BillboardPlacement is set, and a flat one again after', () => {
      const material = new FeatureSpritesMaterial(TexturedKind);
      const {positionNode, version} = material;

      material.placement = BillboardPlacement;

      expect(material.positionNode).not.toBe(positionNode);
      expect(material.version).toBeGreaterThan(version);
      expect(attributeNamesOf(operatorOf(material.positionNode).aNode as Node)).toEqual(['instancePosition']);
      material.placement = FlatPlacement;
      expect(attributeNamesOf(operatorOf(material.positionNode).bNode as Node)).toEqual(['instancePosition']);
      material.dispose();
    });

    test('starts with the placement it is given', () => {
      const material = new FeatureSpritesMaterial(TexturedKind, {placement: BillboardPlacement});

      expect(material.placement).toBe(BillboardPlacement);
      material.dispose();
    });

    test('builds nothing for a write of the placement it holds', () => {
      const material = new FeatureSpritesMaterial(TexturedKind);
      const {positionNode, version} = material;

      material.placement = FlatPlacement;

      expect([material.positionNode, material.version]).toEqual([positionNode, version]);
      material.dispose();
    });

    test('refuses a feature without a placement stage', () => {
      const material = new FeatureSpritesMaterial(TexturedKind);

      expect(() => {
        material.placement = Tint;
      }).toThrow('FeatureSpritesMaterial: feature "tint" contributes no placement stage and cannot stand in for "flatPlacement"');
      expect(material.placement).toBe(FlatPlacement);
      material.dispose();
    });

    test('refuses a placement that brings more than its stage, naming both features', () => {
      const heavy = defineFeature({name: 'heavy', attributes: {lift: {size: 1}}, placement: (local) => local});
      const material = new FeatureSpritesMaterial(TexturedKind);

      expect(() => {
        material.placement = heavy;
      }).toThrow(
        'FeatureSpritesMaterial: feature "heavy" brings attributes besides its placement stage; the sprites were built without them, so it cannot stand in for "flatPlacement"',
      );
      material.dispose();
    });

    test('refuses a placement whose requires the kind does not meet', () => {
      const anchored = defineFeature({name: 'anchored', requires: ['anchor'], placement: (local) => local});
      const material = new FeatureSpritesMaterial(TexturedKind);

      expect(() => {
        material.placement = anchored;
      }).toThrow('FeatureSpritesMaterial: feature "anchored" requires feature "anchor", which the sprite kind does not hold');
      material.dispose();
    });

    test('takes a placement that requires nothing', () => {
      const lifted = defineFeature({name: 'lifted', placement: (local) => add(local, vec3(0, 0, 1))});
      const material = new FeatureSpritesMaterial(TexturedKind);
      const {positionNode} = material;

      material.placement = lifted;

      expect(material.placement).toBe(lifted);
      expect(material.positionNode).not.toBe(positionNode);
      material.dispose();
    });

    test('takes the placement of the kind back even though it brings more', () => {
      const own = defineFeature({name: 'own', attributes: {lift: {size: 1}}, placement: (local) => local});
      const kind = defineSprite({base: QuadBase, features: [InstancePosition, own]});
      const material = new FeatureSpritesMaterial(kind);

      material.placement = BillboardPlacement;
      expect(() => {
        material.placement = own;
      }).not.toThrow();
      expect(material.placement).toBe(own);
      material.dispose();
    });

    test('refuses a placement option the same way and leaves nothing behind', () => {
      const baseline = [getSignalsCount(), getEffectsCount()];

      expect(() => new FeatureSpritesMaterial(TexturedKind, {placement: Tint})).toThrow(
        'FeatureSpritesMaterial: feature "tint" contributes no placement stage and cannot stand in for "flatPlacement"',
      );
      expect([getSignalsCount(), getEffectsCount()]).toEqual(baseline);
    });

    test('keeps its last value for a write after dispose(), and builds nothing', () => {
      const material = new FeatureSpritesMaterial(TexturedKind);
      const {positionNode, version} = material;
      material.dispose();

      expect(() => {
        material.placement = BillboardPlacement;
      }).not.toThrow();

      expect([material.positionNode, material.version]).toEqual([positionNode, version]);
    });
  });

  describe('the color graph', () => {
    test('tints a flat grey by the sprite color while there is no colorMap', () => {
      const material = new FeatureSpritesMaterial(TexturedKind);

      const color = operatorOf(material.colorNode);
      expect(color.op).toBe('*');
      expect(textureNodesOf(material.colorNode!)).toEqual([]);
      expect(attributeNamesOf(color.bNode as Node)).toEqual(['color']);
      material.dispose();
    });

    test('draws flat grey without a color source and without a tint', () => {
      const material = new FeatureSpritesMaterial(PlainKind);

      expect(textureNodesOf(material.colorNode!)).toEqual([]);
      expect(attributeNamesOf(material.colorNode!)).toEqual([]);
      material.dispose();
    });

    test('samples the colorMap once one is set, through a varying, still tinted', () => {
      const colorMap = new Texture();
      const material = new FeatureSpritesMaterial(TexturedKind);
      const {colorNode, version} = material;

      material.setTexture('colorMap', colorMap);

      expect(material.colorNode).not.toBe(colorNode);
      expect(material.version).toBeGreaterThan(version);
      const [sample] = textureNodesOf(material.colorNode!);
      expect(sample!.value).toBe(colorMap);
      expect((sample!.uvNode as unknown as VaryingNode<unknown>).isVaryingNode).toBe(true);
      expect(attributeNamesOf(material.colorNode!)).toContain('color');
      material.dispose();
    });

    test('runs the color stages by order', () => {
      const kind = defineSprite({
        base: QuadBase,
        features: [InstancePosition, FlatPlacement, recorder('late', 'color', 300), recorder('early', 'color', 100)],
      });

      const material = new FeatureSpritesMaterial(kind);

      expect(calls).toEqual(['early', 'late']);
      material.dispose();
    });
  });

  describe('textures', () => {
    test('a texture of the same kind keeps both graphs and hands the sample the new texture', () => {
      const a = new Texture();
      const b = new Texture();
      const material = new FeatureSpritesMaterial(TexturedKind, {textures: {colorMap: a}});
      const {colorNode, positionNode, version} = material;

      material.setTexture('colorMap', b);

      expect(material.colorNode).toBe(colorNode);
      expect(material.positionNode).toBe(positionNode);
      expect(material.version).toBe(version);
      expect(samplesTexture(material.colorNode!, b)).toBe(true);
      material.dispose();
    });

    test('a texture of another kind builds a new color graph', () => {
      const nearest = new Texture();
      nearest.minFilter = NearestFilter;
      nearest.magFilter = NearestFilter;
      const material = new FeatureSpritesMaterial(TexturedKind, {textures: {colorMap: new Texture()}});
      const {colorNode} = material;

      material.setTexture('colorMap', nearest);

      expect(material.colorNode).not.toBe(colorNode);
      expect(samplesTexture(material.colorNode!, nearest)).toBe(true);
      material.dispose();
    });

    test('clearing the texture builds the flat grey again', () => {
      const material = new FeatureSpritesMaterial(TexturedKind, {textures: {colorMap: new Texture()}});

      material.setTexture('colorMap', undefined);

      expect(textureNodesOf(material.colorNode!)).toEqual([]);
      material.dispose();
    });

    test('a frame feature waits for the image of its texture, and touchTexture() picks it up', () => {
      const lookup = new Texture();
      const material = new FeatureSpritesMaterial(LookupKind, {textures: {lookup, colorMap: new Texture()}});

      // the default frame: no trim, so the position graph reads no uv
      expect(attributeNamesOf(material.positionNode!)).not.toContain('uv');
      expect(samplesTexture(material.colorNode!, lookup)).toBe(false);

      lookup.image = {width: 4, height: 4} as unknown as HTMLImageElement;
      material.touchTexture('lookup');

      expect(attributeNamesOf(material.positionNode!)).toContain('uv');
      expect(samplesTexture(material.positionNode!, lookup)).toBe(true);
      expect(samplesTexture(material.colorNode!, lookup)).toBe(true);
      material.dispose();
    });

    test('a write to the texture of the frame builds the position and the color graph once each', () => {
      const material = new FeatureSpritesMaterial(LookupKind, {textures: {colorMap: new Texture()}});
      const {version} = material;

      material.setTexture('lookup', withImage());

      // one needsUpdate per graph
      expect(material.version).toBe(version + 2);
      material.dispose();
    });

    test('a frame texture of the same kind and another size builds nothing and updates the size uniform', () => {
      const material = new FeatureSpritesMaterial(LookupKind, {textures: {lookup: withImage(4, 4), colorMap: new Texture()}});
      const {positionNode, colorNode, version} = material;
      const bigger = withImage(8, 2);

      material.setTexture('lookup', bigger);

      expect([material.positionNode, material.colorNode, material.version]).toEqual([positionNode, colorNode, version]);
      expect(samplesTexture(material.positionNode!, bigger)).toBe(true);
      expect(material.resources.textureSize('lookup').value.toArray()).toEqual([8, 2]);
      material.dispose();
    });
  });

  describe('uniforms', () => {
    test('exposes the uniforms of its resources and writes them through setUniform()', () => {
      const timed = defineFeature({name: 'timed', uniforms: {time: 0}});
      const material = new FeatureSpritesMaterial(
        defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, timed]}),
        {uniforms: {time: 2}},
      );
      const {version} = material;

      expect(material.uniforms['time']!.value).toBe(2);
      material.setUniform('time', 3);
      expect(material.uniforms['time']!.value).toBe(3);
      expect(material.version).toBe(version);
      material.dispose();
    });
  });

  describe('dispose()', () => {
    test('does NOT dispose a texture handed in, through the constructor or the setter', () => {
      const a = new Texture();
      const b = new Texture();
      const aDispose = sandbox.spy(a, 'dispose');
      const bDispose = sandbox.spy(b, 'dispose');
      const material = new FeatureSpritesMaterial(TexturedKind, {textures: {colorMap: a}});
      material.setTexture('colorMap', b);

      material.dispose();

      expect([aDispose.called, bDispose.called]).toEqual([false, false]);
    });

    test('releases the resources it built and leaves resources handed in alone', () => {
      const shared = new SpriteResources(TexturedKind.features, {textures: {colorMap: new Texture()}});
      const own = new FeatureSpritesMaterial(TexturedKind, {textures: {colorMap: new Texture()}});
      const borrowing = new FeatureSpritesMaterial(TexturedKind, {resources: shared});

      own.dispose();
      borrowing.dispose();

      expect(own.resources.isDisposed).toBe(true);
      expect(shared.isDisposed).toBe(false);
      expect(shared.getTexture('colorMap')).toBeDefined();
      shared.dispose();
    });

    test('behaves as documented afterwards', () => {
      const material = new FeatureSpritesMaterial(TexturedKind, {textures: {colorMap: new Texture()}});
      const {positionNode, colorNode} = material;

      material.dispose();

      expect(material.getTexture('colorMap')).toBeUndefined();
      expect(() => material.setTexture('colorMap', new Texture())).not.toThrow();
      expect(material.placement).toBe(FlatPlacement);
      expect([material.positionNode, material.colorNode]).toEqual([positionNode, colorNode]);
    });

    test('is safe to call twice', () => {
      const material = new FeatureSpritesMaterial(TexturedKind);

      expect(() => {
        material.dispose();
        material.dispose();
      }).not.toThrow();
    });

    test('does not leak signals or effects', () => {
      const signals = getSignalsCount();
      const effects = getEffectsCount();

      const material = new FeatureSpritesMaterial(LookupKind, {textures: {colorMap: new Texture(), lookup: withImage()}});
      expect(getEffectsCount()).toBeGreaterThan(effects);
      material.dispose();

      expect(getSignalsCount()).toBe(signals);
      expect(getEffectsCount()).toBe(effects);
    });

    test('builds no node on the way out', () => {
      const material = new FeatureSpritesMaterial(LookupKind, {textures: {colorMap: new Texture(), lookup: withImage()}});
      const {version} = material;

      material.dispose();

      expect(material.version).toBe(version);
    });
  });

  describe('a pass material', () => {
    const lift = recorder('lift', 'mesh', 100);
    const darken = defineFeature({...recorder('darken', 'color', 200), uniforms: {shade: 0.5}});

    test('runs the stages of the kind and of the pass, leaving out those of the features named in without', () => {
      const kind = defineSprite({
        base: QuadBase,
        features: [InstancePosition, recordingPlacement, recorder('tintStage', 'color', 100)],
      });
      const pass = definePass({name: 'p', features: [lift, darken], without: ['tintStage']});

      const material = new FeatureSpritesMaterial(kind, {pass});

      expect(calls).toEqual(['placement', 'lift', 'darken']);
      expect(material.pass).toBe(pass);
      expect(material.uniforms['shade']!.value).toBe(0.5);
      material.dispose();
    });

    test('is no pass material without a pass', () => {
      const material = new FeatureSpritesMaterial(TexturedKind);

      expect(material.pass).toBeUndefined();
      material.dispose();
    });

    test('takes the material parameters of the pass', () => {
      const material = new FeatureSpritesMaterial(TexturedKind, {
        pass: definePass({name: 'p', features: [], material: {transparent: true, depthWrite: false}}),
      });

      expect([material.transparent, material.depthWrite]).toEqual([true, false]);
      material.dispose();
    });

    test('lets a parameter handed in win over the one of the pass, and an alphaTest of the pass replace the default', () => {
      const material = new FeatureSpritesMaterial(TexturedKind, {
        pass: definePass({name: 'p', features: [], material: {transparent: true, alphaTest: 0.25}}),
        transparent: false,
      });

      expect(material.transparent).toBe(false);
      expect(material.alphaTest).toBe(0.25);
      expect(material.alphaTestNode).toBeNull();
      material.dispose();
    });

    test('takes a pass feature whose requires the kind or the pass meets', () => {
      const anchor = defineFeature({name: 'anchor', local: {order: 100, transform: (p) => p}});
      const onTint = defineFeature({name: 'onTint', requires: ['tint'], color: {order: 250, transform: (c) => c}});
      const onAnchor = defineFeature({name: 'onAnchor', requires: ['anchor'], mesh: {order: 100, transform: (p) => p}});

      const material = new FeatureSpritesMaterial(TexturedKind, {
        pass: definePass({name: 'p', features: [anchor, onTint, onAnchor]}),
      });

      expect(material.pass!.features).toEqual([anchor, onTint, onAnchor]);
      material.dispose();
    });

    test('refuses a without the kind does not hold, a without of the placement, and an unmet requires, and leaves nothing behind', () => {
      const needsAnchor = defineFeature({name: 'needsAnchor', requires: ['anchor'], color: {order: 1, transform: (c) => c}});
      const baseline = [getSignalsCount(), getEffectsCount()];

      expect(
        () => new FeatureSpritesMaterial(TexturedKind, {pass: definePass({name: 'p', features: [], without: ['tnt']})}),
      ).toThrow('FeatureSpritesMaterial: pass "p" leaves out feature "tnt", which the sprite kind does not hold');
      expect(
        () => new FeatureSpritesMaterial(TexturedKind, {pass: definePass({name: 'p', features: [], without: ['flatPlacement']})}),
      ).toThrow(
        'FeatureSpritesMaterial: pass "p" leaves out the placement "flatPlacement"; a pass draws with the placement of the sprites',
      );
      expect(() => new FeatureSpritesMaterial(TexturedKind, {pass: definePass({name: 'p', features: [needsAnchor]})})).toThrow(
        'FeatureSpritesMaterial: feature "needsAnchor" of pass "p" requires feature "anchor", which neither the sprite kind nor the pass holds',
      );
      expect([getSignalsCount(), getEffectsCount()]).toEqual(baseline);
    });

    test('refuses a pass that brings a second color source, and leaves nothing behind', () => {
      const flat = defineFeature({name: 'flat', colorSource: () => vec4(0, 0, 0, 1) as unknown as Node<'vec4'>});
      const baseline = [getSignalsCount(), getEffectsCount()];

      expect(() => new FeatureSpritesMaterial(TexturedKind, {pass: definePass({name: 'p', features: [flat]})})).toThrow(
        'FeatureSpritesMaterial: pass "p": features "textureColor" and "flat" each contribute a colorSource stage; a sprite takes at most one',
      );
      expect([getSignalsCount(), getEffectsCount()]).toEqual(baseline);
    });

    test('judges a placement by the features of the kind, not by those of the pass', () => {
      const anchor = defineFeature({name: 'anchor', local: {order: 100, transform: (p) => p}});
      const anchored = defineFeature({name: 'anchored', requires: ['anchor'], placement: (local) => local});
      const material = new FeatureSpritesMaterial(TexturedKind, {pass: definePass({name: 'p', features: [anchor]})});

      expect(() => {
        material.placement = anchored;
      }).toThrow('FeatureSpritesMaterial: feature "anchored" requires feature "anchor", which the sprite kind does not hold');
      material.placement = BillboardPlacement;
      expect(material.placement).toBe(BillboardPlacement);
      material.dispose();
    });
  });
});
