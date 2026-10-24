import {describe, expect, expectTypeOf, test} from 'vitest';

import {Tint} from './features/Tint.js';
import {ColorOrder, defineFeature, FrameOrder, LocalOrder, MeshOrder, type SpriteFeature, UvOrder} from './SpriteFeature.js';

// a malformed feature for every field defineFeature() checks, with the refusal in the words of `where`
const malformedFeatures = (where: string): [string, unknown, string][] => [
  ['null', null, `${where}: a feature is an object with a name, got null`],
  ['a list', ['odd'], `${where}: a feature is an object with a name, got ["odd"]`],
  [
    'attributes that are no record',
    {name: 'odd', attributes: ['x']},
    `${where}: the attributes of feature "odd" are no record of attribute descriptions, got ["x"]`,
  ],
  [
    'an attribute that is no description',
    {name: 'odd', attributes: {x: 3}},
    `${where}: the attribute "x" of feature "odd" is no attribute description, got 3`,
  ],
  [
    'usageAliases that are no record',
    {name: 'odd', usageAliases: 'size'},
    `${where}: the usageAliases of feature "odd" are no record of attribute name lists, got "size"`,
  ],
  [
    'a usage alias that is no list',
    {name: 'odd', usageAliases: {size: 'quadSize'}},
    `${where}: the usage alias "size" of feature "odd" is no list of attribute names, got "quadSize"`,
  ],
  [
    'methods that are no record',
    {name: 'odd', methods: [1]},
    `${where}: the methods of feature "odd" are no record of functions, got [1]`,
  ],
  [
    'a method that is no function',
    {name: 'odd', methods: {go: 1}},
    `${where}: the method "go" of feature "odd" is no function, got 1`,
  ],
  [
    'an initialize that is no function',
    {name: 'odd', initialize: true},
    `${where}: the initialize of feature "odd" is no function, got true`,
  ],
  [
    'uniforms that are no record',
    {name: 'odd', uniforms: 5},
    `${where}: the uniforms of feature "odd" are no record of uniform declarations, got 5`,
  ],
  [
    'textures that are no record',
    {name: 'odd', textures: ['map']},
    `${where}: the textures of feature "odd" are no record of texture declarations, got ["map"]`,
  ],
  [
    'a texture declared with null',
    {name: 'odd', textures: {x: null}},
    `${where}: the texture "x" of feature "odd" is declared with null; a texture takes {} or {needsImage: true}`,
  ],
  [
    'a texture whose needsImage is no boolean',
    {name: 'odd', textures: {x: {needsImage: 'yes'}}},
    `${where}: the texture "x" of feature "odd" is declared with {needsImage: "yes"}; a texture takes {} or {needsImage: true}`,
  ],
  ['a frame that is no function', {name: 'odd', frame: {}}, `${where}: the frame of feature "odd" is no function, got {}`],
  [
    'a placement that is no function',
    {name: 'odd', placement: 5},
    `${where}: the placement of feature "odd" is no function, got 5`,
  ],
  [
    'a colorSource that is no function',
    {name: 'odd', colorSource: 5},
    `${where}: the colorSource of feature "odd" is no function, got 5`,
  ],
  [
    'a stage that is no record',
    {name: 'odd', local: 1},
    `${where}: the local stage of feature "odd" is no {order, transform}, got 1`,
  ],
  [
    'a stage without a finite order',
    {name: 'odd', local: {order: Number.NaN, transform: (input: unknown) => input}},
    `${where}: the local stage of feature "odd" needs a finite order, got NaN`,
  ],
  [
    'a stage without a transform',
    {name: 'odd', local: {order: 1}},
    `${where}: the local stage of feature "odd" needs a transform function, got undefined`,
  ],
  [
    'requires that is no list',
    {name: 'odd', requires: 'abc'},
    `${where}: the requires of feature "odd" is no list of feature names, got "abc"`,
  ],
  ['a name that is no string', {name: 5}, `${where}: a feature needs a name, got 5`],
  [
    'a checkKind that is no function',
    {name: 'odd', checkKind: 'grid'},
    `${where}: the checkKind of feature "odd" is no function, got "grid"`,
  ],
  [
    'nearestTextures that is no list',
    {name: 'odd', nearestTextures: 'colorMap'},
    `${where}: the nearestTextures of feature "odd" is no list of texture names, got "colorMap"`,
  ],
];

describe('defineFeature()', () => {
  test('answers the feature it is given, frozen', () => {
    const feature = defineFeature({name: 'marker', requires: ['other']});

    expect(feature.name).toBe('marker');
    expect(feature.requires).toEqual(['other']);
    expect(Object.isFrozen(feature)).toBe(true);
  });

  test('refuses a feature without a name', () => {
    expect(() => defineFeature({name: ''})).toThrow('defineFeature: a feature needs a name, got ""');
  });

  test.each(['frameStage', 'local', 'mesh', 'uv', 'color'] as const)('refuses a %s stage without a finite order', (slot) => {
    const feature = {name: 'odd', [slot]: {order: Number.NaN, transform: (input: unknown) => input}} as unknown as SpriteFeature;

    expect(() => defineFeature(feature)).toThrow(
      `defineFeature: the ${slot} stage of feature "odd" needs a finite order, got NaN`,
    );
  });

  test('refuses a stage whose order is a string, quoting it', () => {
    const feature = {name: 'odd', local: {order: '1', transform: (input: unknown) => input}} as unknown as SpriteFeature;

    expect(() => defineFeature(feature)).toThrow('defineFeature: the local stage of feature "odd" needs a finite order, got "1"');
  });

  test('refuses a checkKind that is no function', () => {
    const feature = {name: 'odd', checkKind: 'grid'} as unknown as SpriteFeature;

    expect(() => defineFeature(feature)).toThrow('defineFeature: the checkKind of feature "odd" is no function, got "grid"');
  });

  test.each([
    ['colorMap', '"colorMap"'],
    [['colorMap', 3], '["colorMap", 3]'],
    [{colorMap: true}, '{colorMap: true}'],
  ])('refuses the nearestTextures %o', (nearestTextures, quoted) => {
    const feature = {name: 'odd', nearestTextures} as unknown as SpriteFeature;

    expect(() => defineFeature(feature)).toThrow(
      `defineFeature: the nearestTextures of feature "odd" is no list of texture names, got ${quoted}`,
    );
  });

  test.each(malformedFeatures('defineFeature'))('refuses %s', (_, feature, message) => {
    expect(() => defineFeature(feature as SpriteFeature)).toThrow(TypeError);
    expect(() => defineFeature(feature as SpriteFeature)).toThrow(new TypeError(message));
  });

  test('checks the stages in the order of their slots, each for a record, its order and its transform', () => {
    const feature = {name: 'odd', frameStage: {order: 1}, color: {order: Number.NaN}} as unknown as SpriteFeature;

    expect(() => defineFeature(feature)).toThrow(
      'defineFeature: the frameStage stage of feature "odd" needs a transform function, got undefined',
    );
  });

  test('freezes the records and lists inside the feature as well', () => {
    expect(Object.isFrozen(Tint.attributes)).toBe(true);
    expect(Object.isFrozen(Tint.attributes!['color'])).toBe(true);
    expect(Object.isFrozen(Tint.methods)).toBe(true);
    expect(Object.isFrozen((Tint.attributes!['color'] as {components: string[]}).components)).toBe(true);
    expect(Object.isFrozen(Tint.color)).toBe(true);
    expect(() => {
      (Tint.methods as Record<string, unknown>)['x'] = 1;
    }).toThrow(TypeError);
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
    expect(LocalOrder).toEqual({Anchor: 100, Flip: 150, Slice: 175, Scale: 200, Shear: 300, Rotate: 400});
    expect(MeshOrder).toEqual({Offset: 100, Project: 200, Mirror: 300});
    expect(ColorOrder).toEqual({Palette: 50, Tint: 100, Mask: 150, Fade: 200, Flash: 300, Pass: 1000});
    expect(FrameOrder).toEqual({Flip: 100});
    expect(UvOrder).toEqual({Slice: 100});
    expect([LocalOrder, MeshOrder, ColorOrder, FrameOrder, UvOrder].every((bands) => Object.isFrozen(bands))).toBe(true);
  });
});
