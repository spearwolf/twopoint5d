import {describe, expect, test} from 'vitest';

import {defineSprite} from '../defineSprite.js';
import {FeatureSprites} from '../FeatureSprites/FeatureSprites.js';
import {FlatPlacement} from '../features/FlatPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {QuadBase} from '../SpriteBase.js';
import {defineFeature} from '../SpriteFeature.js';
import {definePass} from './definePass.js';
import {ShadowPass} from './passPresets.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement]});

const mask = defineFeature({name: 'mask', uniforms: {shadowColor: [0, 0, 0, 0.5]}, color: {order: 150, transform: (c) => c}});

describe('definePass()', () => {
  test('answers the pass, frozen', () => {
    const pass = definePass({name: 'shadow', features: [mask], renderOrder: -1, material: {transparent: true}});

    expect(pass.features).toEqual([mask]);
    expect(Object.isFrozen(pass)).toBe(true);
  });

  test.each([
    ['attributes', {attributes: {lift: {size: 1}}}],
    ['methods', {methods: {lift() {}}}],
    ['initialize', {initialize() {}}],
    ['usageAliases', {usageAliases: {up: ['lift']}}],
  ])('refuses a feature that brings %s', (field, extra) => {
    const feature = defineFeature({name: 'data', ...(extra as object)});

    expect(() => definePass({name: 'p', features: [feature]})).toThrow(
      `definePass: feature "data" of pass "p" brings ${field}; a pass draws the data of the sprites and brings stages, uniforms and textures alone`,
    );
  });

  test('takes one feature that brings a placement, and refuses a second', () => {
    const facing = defineFeature({name: 'facing', placement: (local) => local});
    const turned = defineFeature({name: 'turned', placement: (local) => local});

    expect(definePass({name: 'p', features: [facing, mask]}).features).toEqual([facing, mask]);
    expect(() => definePass({name: 'p', features: [facing, mask, turned]})).toThrow(
      'definePass: features "facing" and "turned" of pass "p" each bring a placement; a pass takes at most one',
    );
  });

  test('refuses a pass without a name, two features of one name and a feature it leaves out twice', () => {
    expect(() => definePass({name: '', features: []})).toThrow('definePass: a pass needs a name, got ""');
    expect(() => definePass({name: 'p', features: [mask, mask]})).toThrow('definePass: pass "p" lists feature "mask" twice');
    expect(() => definePass({name: 'p', features: [], without: ['tint', 'tint']})).toThrow(
      'definePass: pass "p" leaves out feature "tint" twice',
    );
  });

  test('checks each feature as defineFeature() checks one, in its own name', () => {
    expect(() =>
      definePass({name: 'p', features: [{name: 'f', color: {order: Number.NaN, transform: (c: unknown) => c}} as never]}),
    ).toThrow(new TypeError('definePass: the color stage of feature "f" needs a finite order, got NaN'));
    expect(() => definePass({name: 'p', features: [null as never]})).toThrow(
      new TypeError('definePass: a feature is an object with a name, got null'),
    );
  });

  test('freezes copies of its features, without and material, and leaves the ones handed in alone', () => {
    const features = [mask];
    const without = ['tint'];
    const material = {transparent: true};

    const pass = definePass({name: 'p', features, without, material});
    without.push('rotation');
    material.transparent = false;

    expect([pass.without, pass.material]).toEqual([['tint'], {transparent: true}]);
    expect([Object.isFrozen(pass.features), Object.isFrozen(pass.without), Object.isFrozen(pass.material)]).toEqual([
      true,
      true,
      true,
    ]);
    expect([Object.isFrozen(features), Object.isFrozen(without), Object.isFrozen(material)]).toEqual([false, false, false]);
  });

  test('adds no without or material to a pass that has none', () => {
    const pass = definePass({name: 'p', features: []});

    expect(Object.keys(pass)).toEqual(['name', 'features']);
  });

  test('refuses a visible that is no function, and keeps one that is', () => {
    const visible = () => true;

    expect(definePass({name: 'p', features: [], visible}).visible).toBe(visible);
    expect(() => definePass({name: 'p', features: [], visible: true as never})).toThrow(
      'definePass: the visible of pass "p" is no function, got true',
    );
  });

  describe('the shape of a pass', () => {
    const shapes: [string, unknown, string, typeof TypeError | typeof RangeError][] = [
      ['a pass that is null', null, 'a pass is an object with a name and features, got null', TypeError],
      ['a pass that is a number', 5, 'a pass is an object with a name and features, got 5', TypeError],
      ['a pass that is an array', [], 'a pass is an object with a name and features, got []', TypeError],
      ['features that are undefined', {name: 'p'}, 'the features of pass "p" are no list of features, got undefined', TypeError],
      [
        'features that are a string',
        {name: 'p', features: 'ab'},
        'the features of pass "p" are no list of features, got "ab"',
        TypeError,
      ],
      [
        'features that are a Set',
        {name: 'p', features: new Set()},
        'the features of pass "p" are no list of features, got [object Set]',
        TypeError,
      ],
      [
        'a without that is a string',
        {name: 'p', features: [], without: 'tint'},
        'the without of pass "p" is no list of feature names, got "tint"',
        TypeError,
      ],
      [
        'a without that holds a number',
        {name: 'p', features: [], without: ['tint', 5]},
        'the without of pass "p" is no list of feature names, got ["tint", 5]',
        TypeError,
      ],
      [
        'uniformNames that are a number',
        {name: 'p', features: [], uniformNames: 5},
        'the uniformNames of pass "p" are no record of uniform names, got 5',
        TypeError,
      ],
      [
        'uniformNames that are an array',
        {name: 'p', features: [], uniformNames: []},
        'the uniformNames of pass "p" are no record of uniform names, got []',
        TypeError,
      ],
      [
        'a material that is a number',
        {name: 'p', features: [], material: 5},
        'the material of pass "p" is no record of material parameters, got 5',
        TypeError,
      ],
      [
        'a material that is an array',
        {name: 'p', features: [], material: []},
        'the material of pass "p" is no record of material parameters, got []',
        TypeError,
      ],
      [
        'a renderOrder that is NaN',
        {name: 'p', features: [], renderOrder: Number.NaN},
        'the renderOrder of pass "p" must be a finite number, got NaN',
        RangeError,
      ],
      [
        'a renderOrder that is a string',
        {name: 'p', features: [], renderOrder: '1'},
        'the renderOrder of pass "p" must be a finite number, got "1"',
        RangeError,
      ],
    ];

    test.each(shapes)('refuses %s', (_label, pass, message, errorClass) => {
      const define = () => definePass(pass as never);

      expect(define).toThrow(new errorClass(`definePass: ${message}`));
    });

    test('takes null for without, uniformNames, material and renderOrder as not brought', () => {
      expect(() =>
        definePass({name: 'p', features: [], without: null, uniformNames: null, material: null, renderOrder: null} as never),
      ).not.toThrow();
    });

    test('is checked by FeatureSprites for a pass that never went through definePass()', () => {
      for (const [, pass, message, errorClass] of shapes) {
        expect(() => new FeatureSprites(kind, {passes: [pass as never]}), message).toThrow(
          new errorClass(`FeatureSprites: ${message}`),
        );
      }
    });
  });

  describe('uniformNames', () => {
    test('freezes a copy of the renaming', () => {
      const names = {groundPlane: 'moonGround'};
      const pass = definePass({...ShadowPass, name: 'moon', uniformNames: names});

      expect(pass.uniformNames).toEqual({groundPlane: 'moonGround'});
      expect(pass.uniformNames).not.toBe(names);
      expect(Object.isFrozen(pass.uniformNames)).toBe(true);
    });

    test('checks the renames before the material', () => {
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {time: 'moonTime'}, material: 5 as never})).toThrow(
        new TypeError('definePass: pass "moon" renames the uniform "time", which no feature of the pass declares'),
      );
    });

    test('refuses a name no feature of the pass declares, an empty target, one that is no string and two names with one target', () => {
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {time: 'moonTime'}})).toThrow(
        'definePass: pass "moon" renames the uniform "time", which no feature of the pass declares',
      );
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {groundPlane: ''}})).toThrow(
        'definePass: pass "moon" renames the uniform "groundPlane" to an empty name',
      );
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {groundPlane: 7 as never}})).toThrow(
        'definePass: pass "moon" renames the uniform "groundPlane" to a name that is not a string, got 7',
      );
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {groundPlane: 'moon', shadowLight: 'moon'}})).toThrow(
        'definePass: pass "moon" renames the uniforms "groundPlane" and "shadowLight" both to "moon"',
      );
    });

    test('refuses a member of Object.prototype as a name no feature of the pass declares', () => {
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {toString: 'moonString'}})).toThrow(
        'definePass: pass "moon" renames the uniform "toString", which no feature of the pass declares',
      );
    });

    test('refuses a target that a feature of the pass declares, and allows the identity', () => {
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {groundPlane: 'shadowLight'}})).toThrow(
        'definePass: pass "moon" renames the uniform "groundPlane" to "shadowLight", which a feature of the pass declares',
      );
      expect(() =>
        definePass({...ShadowPass, name: 'moon', uniformNames: {shadowLight: 'groundPlane', groundPlane: 'moonGround'}}),
      ).toThrow('renames the uniform "shadowLight" to "groundPlane", which a feature of the pass declares');
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {groundPlane: 'groundPlane'}})).not.toThrow();
    });
  });
});
