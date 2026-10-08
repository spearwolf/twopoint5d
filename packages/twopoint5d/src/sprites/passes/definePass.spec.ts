import {describe, expect, test} from 'vitest';

import {defineFeature} from '../SpriteFeature.js';
import {definePass} from './definePass.js';

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
    ['placement', {placement: (local: never) => local}],
  ])('refuses a feature that brings %s', (field, extra) => {
    const feature = defineFeature({name: 'data', ...(extra as object)});

    expect(() => definePass({name: 'p', features: [feature]})).toThrow(
      `definePass: feature "data" of pass "p" brings ${field}; a pass draws the data of the sprites and brings stages, uniforms and textures alone`,
    );
  });

  test('refuses a pass without a name and two features of one name', () => {
    expect(() => definePass({name: '', features: []})).toThrow('definePass: a pass needs a name');
    expect(() => definePass({name: 'p', features: [mask, mask]})).toThrow('definePass: pass "p" lists feature "mask" twice');
  });
});
