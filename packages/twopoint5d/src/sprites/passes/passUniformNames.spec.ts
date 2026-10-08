import type {Node} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {collectSpriteDeclarations} from '../spriteDeclarations.js';
import type {SpriteFrameContext, SpriteShaderContext} from '../SpriteFeature.js';
import {defineFeature} from '../SpriteFeature.js';
import {definePass} from './definePass.js';
import {originOf, resolvedUniformName, stageFeaturesOf} from './passUniformNames.js';

const node = (label: string) => label as unknown as Node<'vec4'>;

// answers the name of every uniform it is asked for, so that a stage shows what it read
const context = (): SpriteShaderContext =>
  ({
    uniform: (name: string) => name,
    sample: (name: string) => name,
    textureSize: (name: string) => name,
    frame: {texCoords: node('texCoords')},
  }) as unknown as SpriteShaderContext;

const read = (ctx: SpriteFrameContext, ...names: string[]) => names.map((name) => ctx.uniform(name));

const probe = defineFeature({
  name: 'probe',
  uniforms: {a: 1, b: [0, 1]},
  textures: {map: {}},
  frame: (ctx) => ({texCoords: read(ctx, 'a', 'b', 'c') as unknown as Node<'vec4'>}),
  local: {order: 1, transform: (input, ctx) => read(ctx, 'a', 'c') as unknown as typeof input},
  mesh: {order: 2, transform: (input, ctx) => read(ctx, 'b') as unknown as typeof input},
  colorSource: (_frame, ctx) => read(ctx, 'a') as unknown as Node<'vec4'>,
  color: {order: 3, transform: (input, ctx) => read(ctx, 'a', 'b') as unknown as typeof input},
});

describe('stageFeaturesOf()', () => {
  test('answers the features of a pass without a renaming, or with an empty one, as they are', () => {
    const plain = definePass({name: 'plain', features: [probe]});
    const empty = definePass({name: 'empty', features: [probe], uniformNames: {}});

    expect(stageFeaturesOf(plain)).toBe(plain.features);
    expect(stageFeaturesOf(empty)).toBe(empty.features);
  });

  test('answers the same renamed copies for one pass on every call, and other copies for another pass', () => {
    const one = definePass({name: 'one', features: [probe], uniformNames: {a: 'x'}});
    const two = definePass({name: 'two', features: [probe], uniformNames: {a: 'x'}});

    expect(stageFeaturesOf(one)).toBe(stageFeaturesOf(one));
    expect(stageFeaturesOf(one)[0]).not.toBe(stageFeaturesOf(two)[0]);
    expect(Object.isFrozen(stageFeaturesOf(one))).toBe(true);
    expect(originOf(stageFeaturesOf(one)[0]!)).toBe(probe);
    expect(originOf(probe)).toBe(probe);
  });

  test('declares the uniforms under the new names and lets every stage read through the renaming', () => {
    const pass = definePass({name: 'p', features: [probe], uniformNames: {a: 'x', b: 'y'}});
    const [copy] = stageFeaturesOf(pass);
    const ctx = context();

    expect(copy!.uniforms).toEqual({x: 1, y: [0, 1]});
    expect(copy!.textures).toBe(probe.textures);
    expect(copy!.frame!(ctx).texCoords).toEqual(['x', 'y', 'c']);
    expect(copy!.local!.transform('in' as never, ctx)).toEqual(['x', 'c']);
    expect(copy!.mesh!.transform('in' as never, ctx)).toEqual(['y']);
    expect(copy!.colorSource!(ctx.frame, ctx)).toEqual(['x']);
    expect(copy!.color!.transform('in' as never, ctx)).toEqual(['x', 'y']);
    expect(copy!.local!.order).toBe(1);
    expect(ctx.sample('map', 'uv' as never)).toBe('map');
  });

  test('leaves a feature without stages and uniforms alone but for the copy', () => {
    const bare = defineFeature({name: 'bare', uniforms: {a: 1}});
    const [copy] = stageFeaturesOf(definePass({name: 'p', features: [bare], uniformNames: {a: 'x'}}));

    expect(copy!.uniforms).toEqual({x: 1});
    expect(copy!.frame).toBeUndefined();
    expect(copy!.color).toBeUndefined();
  });
});

describe('resolvedUniformName()', () => {
  test('answers the name in the pass, or the declared name', () => {
    const pass = definePass({name: 'p', features: [probe], uniformNames: {a: 'x'}});

    expect(resolvedUniformName(pass, 'a')).toBe('x');
    expect(resolvedUniformName(pass, 'b')).toBe('b');
    expect(resolvedUniformName(definePass({name: 'q', features: [probe]}), 'a')).toBe('a');
  });
});

describe('collectSpriteDeclarations() with renamed copies', () => {
  test('declares a texture once for a feature and its copy, and the uniforms of both', () => {
    const [copy] = stageFeaturesOf(definePass({name: 'p', features: [probe], uniformNames: {a: 'x'}}));
    const {uniforms, textures} = collectSpriteDeclarations([probe, copy!], 'test');

    expect([...uniforms.keys()]).toEqual(['a', 'b', 'x']);
    expect([...textures.keys()]).toEqual(['map']);
  });
});
