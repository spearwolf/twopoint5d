import {describe, expect, test} from 'vitest';

import {defineFeature} from '../SpriteFeature.js';
import {definePass} from './definePass.js';
import {ShadowPass} from './passPresets.js';

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
    expect(() => definePass({name: '', features: []})).toThrow('definePass: a pass needs a name');
    expect(() => definePass({name: 'p', features: [mask, mask]})).toThrow('definePass: pass "p" lists feature "mask" twice');
    expect(() => definePass({name: 'p', features: [], without: ['tint', 'tint']})).toThrow(
      'definePass: pass "p" leaves out feature "tint" twice',
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
      'definePass: the visible of pass "p" is no function',
    );
  });

  describe('uniformNames', () => {
    test('freezes a copy of the renaming', () => {
      const names = {groundPlane: 'moonGround'};
      const pass = definePass({...ShadowPass, name: 'moon', uniformNames: names});

      expect(pass.uniformNames).toEqual({groundPlane: 'moonGround'});
      expect(pass.uniformNames).not.toBe(names);
      expect(Object.isFrozen(pass.uniformNames)).toBe(true);
    });

    test('refuses a name no feature of the pass declares, an empty target, one that is no string and two names with one target', () => {
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {time: 'moonTime'}})).toThrow(
        'definePass: pass "moon" renames the uniform "time", which no feature of the pass declares',
      );
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {groundPlane: ''}})).toThrow(
        'definePass: pass "moon" renames the uniform "groundPlane" to an empty name',
      );
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {groundPlane: 7 as never}})).toThrow(
        'definePass: pass "moon" renames the uniform "groundPlane" to a name that is not a string',
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
