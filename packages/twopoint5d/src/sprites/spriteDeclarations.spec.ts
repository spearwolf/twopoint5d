import {Vector2, Vector4} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {FeatureSprites} from './FeatureSprites/FeatureSprites.js';
import {SpriteResources} from './FeatureSprites/SpriteResources.js';
import {defineSprite} from './defineSprite.js';
import {AnimatedFrames} from './features/AnimatedFrames.js';
import {FlatPlacement} from './features/FlatPlacement.js';
import {InstancePosition} from './features/InstancePosition.js';
import {definePass} from './passes/definePass.js';
import {stageFeaturesOf} from './passes/passUniformNames.js';
import {QuadBase} from './SpriteBase.js';
import {collectSpriteDeclarations} from './spriteDeclarations.js';
import {defineFeature, type SpriteFeature, type SpriteUniformDeclaration, type SpriteUniformValue} from './SpriteFeature.js';

const declaring = (name: string, value: SpriteUniformValue | SpriteUniformDeclaration, uniform = 'time'): SpriteFeature =>
  defineFeature({name, uniforms: {[uniform]: value}});

const collect = (...features: SpriteFeature[]) => collectSpriteDeclarations(features, 'test');

describe('shared uniforms', () => {
  test('identical shared declarations of two features are one uniform, held for the first', () => {
    const a = declaring('a', {value: 0, shared: true});
    const b = declaring('b', {value: 0, shared: true});
    const {uniforms} = collect(a, b);

    expect([...uniforms.keys()]).toEqual(['time']);
    expect(uniforms.get('time')).toEqual({feature: a, value: 0, shared: true});
  });

  test('a shared vector merges when every component agrees', () => {
    const {uniforms} = collect(declaring('a', {value: [1, 2], shared: true}), declaring('b', {value: [1, 2], shared: true}));

    expect(uniforms.get('time')!.value).toEqual([1, 2]);
  });

  test('a declaration with options and shared left out is a plain uniform', () => {
    const {uniforms} = collect(declaring('a', {value: [0, 1, 0, 1]}));

    expect(uniforms.get('time')).toEqual({feature: expect.anything(), value: [0, 1, 0, 1], shared: false});
  });

  test('refuses two plain declarations, naming the way to share one', () => {
    expect(() => collect(declaring('a', 0), declaring('b', 0))).toThrow(
      'test: features "a" and "b" both declare the uniform "time" — rename one of them, or declare it as {value, shared: true} in both to share one uniform',
    );
  });

  test('refuses a shared and a plain declaration, either way round, naming the one that does not share it', () => {
    expect(() => collect(declaring('animatedFrames', {value: 0, shared: true}), declaring('bob', 0))).toThrow(
      'test: features "animatedFrames" and "bob" both declare the uniform "time", and only "animatedFrames" shares it — declare it as {value: 0, shared: true} in "bob" as well, or rename one of them',
    );
    expect(() => collect(declaring('bob', [1, 2]), declaring('animatedFrames', {value: [1, 2], shared: true}))).toThrow(
      'test: features "bob" and "animatedFrames" both declare the uniform "time", and only "animatedFrames" shares it — declare it as {value: [1,2], shared: true} in "bob" as well, or rename one of them',
    );
  });

  test('refuses two shared declarations of another type', () => {
    expect(() => collect(declaring('a', {value: 0, shared: true}), declaring('b', {value: [0, 0], shared: true}))).toThrow(
      'test: features "a" and "b" both declare the uniform "time", shared, as a float and as a vec2 — a shared uniform has one type and one start value in every feature that declares it; rename one of them',
    );
  });

  test('refuses two shared declarations of another start value', () => {
    expect(() => collect(declaring('a', {value: 0, shared: true}), declaring('b', {value: 1, shared: true}))).toThrow(
      'test: features "a" and "b" both declare the uniform "time", shared, starting at 0 and at 1 — a shared uniform has one type and one start value in every feature that declares it; give both the same start value',
    );
    expect(() =>
      collect(declaring('a', {value: [0, 1, 0], shared: true}), declaring('b', {value: [0, 1, 1], shared: true})),
    ).toThrow('starting at [0,1,0] and at [0,1,1]');
  });

  test.each([
    [{value: 0, share: true}, '{"value":0,"share":true}'],
    [{value: 'x', shared: true}, '{"value":"x","shared":true}'],
    [{value: 0, shared: 'yes'}, '{"value":0,"shared":"yes"}'],
    [{shared: true}, '{"shared":true}'],
    ['fast', 'fast'],
  ])('refuses the malformed declaration %j', (declaration, shown) => {
    expect(() => collect(declaring('odd', declaration as never))).toThrow(
      `test: feature "odd" starts the uniform "time" with ${shown}; a uniform takes a number, 2 to 4 numbers, or {value, shared}`,
    );
  });

  test('SpriteResources holds one uniform node for a shared name, at the start value given', () => {
    const resources = new SpriteResources(
      [declaring('a', {value: [0, 0, 0, 0], shared: true}), declaring('b', {value: [0, 0, 0, 0], shared: true})],
      {uniforms: {time: [1, 2, 3, 4]}},
    );

    expect(Object.keys(resources.uniforms)).toEqual(['time']);
    expect(resources.uniforms['time']!.value).toEqual(new Vector4(1, 2, 3, 4));
    expect(resources.declares(declaring('b', {value: [0, 0, 0, 0], shared: true}))).toBe(true);
    resources.dispose();
  });

  test('a kind of AnimatedFrames and a feature that shares time holds one time', () => {
    const bob = declaring('bob', {value: 0, shared: true});
    const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, AnimatedFrames, bob]});
    const sprites = new FeatureSprites(kind, {capacity: 1});

    sprites.setUniform('time', 2.5);

    expect(Object.keys(sprites.uniforms!)).toEqual(['time']);
    expect(sprites.uniforms!['time']!.value).toBe(2.5);
    sprites.dispose();
  });

  test('a feature of a pass that shares time reads the time of the kind', () => {
    const passTime = defineFeature({
      name: 'passTime',
      uniforms: {time: {value: 0, shared: true}},
      color: {order: 1, transform: (color) => color},
    });
    const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, AnimatedFrames]});
    const sprites = new FeatureSprites(kind, {capacity: 1, passes: [definePass({name: 'p', features: [passTime]})]});

    expect(sprites.passes['p']!.material.uniforms['time']).toBe(sprites.uniforms!['time']);
    sprites.dispose();
  });

  test('bindUniform() writes a shared uniform for every feature that declares it', () => {
    const a = declaring('a', {value: [0, 0, 0, 0], shared: true}, 'light');
    const b = declaring('b', {value: [0, 0, 0, 0], shared: true}, 'light');
    const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, a, b]});
    const sprites = new FeatureSprites(kind, {capacity: 1});

    sprites.bindUniform('light', {
      type: 'vec4',
      write(out) {
        out.set(1, 2, 3, 0);
      },
    });
    sprites.update();

    expect(sprites.uniforms!['light']!.value).toEqual(new Vector4(1, 2, 3, 0));
    sprites.dispose();
  });

  test('a renamed copy of a pass declares the shared uniform under the new name, shared, apart from the kind', () => {
    const passTime = defineFeature({
      name: 'passTime',
      uniforms: {time: {value: [0, 0], shared: true}},
      color: {order: 1, transform: (color) => color},
    });
    const pass = definePass({name: 'p', features: [passTime], uniformNames: {time: 'passTime'}});
    const [copy] = stageFeaturesOf(pass);
    const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, AnimatedFrames]});
    const sprites = new FeatureSprites(kind, {capacity: 1, passes: [pass]});

    expect(copy!.uniforms).toEqual({passTime: {value: [0, 0], shared: true}});
    expect(sprites.uniforms!['passTime']!.value).toEqual(new Vector2(0, 0));
    expect(sprites.uniforms!['passTime']).not.toBe(sprites.uniforms!['time']);
    sprites.dispose();
  });

  test('a pass that renames a uniform onto the shared time of the kind is refused, naming why', () => {
    const light = defineFeature({name: 'light', uniforms: {lightTime: 0}, color: {order: 1, transform: (color) => color}});
    const pass = definePass({name: 'p', features: [light], uniformNames: {lightTime: 'time'}});
    const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, AnimatedFrames]});

    expect(() => new FeatureSprites(kind, {passes: [pass]})).toThrow(
      'FeatureSprites: features "animatedFrames" and "light" both declare the uniform "time", and only "animatedFrames" shares it',
    );
  });
});
