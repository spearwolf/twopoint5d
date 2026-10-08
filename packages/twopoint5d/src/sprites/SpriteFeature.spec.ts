import {describe, expect, expectTypeOf, test} from 'vitest';

import {ColorOrder, defineFeature, LocalOrder, MeshOrder, type SpriteFeature} from './SpriteFeature.js';

describe('defineFeature()', () => {
  test('answers the feature it is given, frozen', () => {
    const feature = defineFeature({name: 'marker', requires: ['other']});

    expect(feature.name).toBe('marker');
    expect(feature.requires).toEqual(['other']);
    expect(Object.isFrozen(feature)).toBe(true);
  });

  test('refuses a feature without a name', () => {
    expect(() => defineFeature({name: ''})).toThrow('defineFeature: a feature needs a name');
  });

  test.each(['local', 'mesh', 'color'] as const)('refuses a %s stage without a finite order', (slot) => {
    const feature = {name: 'odd', [slot]: {order: Number.NaN, transform: (input: unknown) => input}} as unknown as SpriteFeature;

    expect(() => defineFeature(feature)).toThrow(
      `defineFeature: the ${slot} stage of feature "odd" needs a finite order, got NaN`,
    );
  });

  test('refuses a feature that requires itself', () => {
    expect(() => defineFeature({name: 'loop', requires: ['loop']})).toThrow('defineFeature: feature "loop" requires itself');
  });

  test('carries the type of the sprite handle in __api (a type-level check)', () => {
    const feature = defineFeature<{width: number}>({name: 'width'});

    expectTypeOf(feature.__api).toEqualTypeOf<{width: number} | undefined>();
  });

  test('types `this` of its methods and of initialize() as the sprite handle (a type-level check)', () => {
    const feature = defineFeature<{width: number; setWidth(width: number): void}>({
      name: 'width',
      methods: {
        setWidth(width: number) {
          this.width = width;
        },
      },
      initialize() {
        this.width = 0;
      },
    });

    // a feature of a narrower handle passes for a feature of any handle, so a kind can list it
    const asAny: SpriteFeature = feature;
    expect(asAny.name).toBe('width');
  });
});

describe('the order bands', () => {
  test('leave room between the built-in stages for stages of your own', () => {
    expect(LocalOrder).toEqual({Anchor: 100, Flip: 150, Scale: 200, Shear: 300, Rotate: 400});
    expect(MeshOrder).toEqual({Offset: 100, Project: 200, Mirror: 300});
    expect(ColorOrder).toEqual({Tint: 100, Mask: 150, Fade: 200, Flash: 300});
    expect(Object.isFrozen(LocalOrder) && Object.isFrozen(MeshOrder) && Object.isFrozen(ColorOrder)).toBe(true);
  });
});
