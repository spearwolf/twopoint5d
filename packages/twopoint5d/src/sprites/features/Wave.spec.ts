import {uniform, vec3} from 'three/tsl';
import {type Node, Vector2, Vector3} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, stubShaderContext} from '../../testing/spriteGraph.js';
import {defineSprite} from '../defineSprite.js';
import {FeatureSpritesMaterial} from '../FeatureSprites/FeatureSpritesMaterial.js';
import {QuadBase} from '../SpriteBase.js';
import {MeshOrder, type SpriteFeature} from '../SpriteFeature.js';
import {AnimatedFrames} from './AnimatedFrames.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {TextureColor} from './TextureColor.js';
import {type WaveOptions, wave} from './Wave.js';

interface Values {
  instancePosition: readonly [number, number, number];
  uv: readonly [number, number];
  waveAmplitude?: number;
  waveFrequency?: number;
  waveSpeed?: number;
  time?: number;
}

// the vertex the mesh stage of `feature` answers for `position`, with the attributes and uniforms given as uniforms
const waved = (feature: SpriteFeature, position: readonly [number, number, number], values: Values) => {
  const context = stubShaderContext();
  const {instancePosition: _position, uv: _uv, ...given} = values;
  const uniforms: Record<string, number> = {waveAmplitude: 1, waveFrequency: 1, waveSpeed: 1, time: 0, ...given};
  return evaluateNode(
    feature.mesh!.transform(vec3(...position) as unknown as Node<'vec3'>, {
      ...context,
      attribute: <T extends string>(name: string) => {
        if (name === 'instancePosition') return uniform(new Vector3(...values.instancePosition)) as unknown as Node<T>;
        if (name === 'uv') return uniform(new Vector2(...values.uv)) as unknown as Node<T>;
        throw new Error(`no value for the attribute "${name}"`);
      },
      uniform: <T extends string>(name: string) => uniform(uniforms[name]!) as unknown as Node<T>,
    }),
  ) as number[];
};

const expectClose = (actual: number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, i) => expect(value, `component ${i} of [${actual}]`).toBeCloseTo(expected[i]!, 6));
};

describe('wave()', () => {
  test('answers one frozen feature per option set, the axis resolved by the weight', () => {
    expect(wave({weight: 'top'})).toBe(wave({weight: 'top'}));
    expect(wave({weight: 'top'})).toBe(wave({weight: 'top', axis: 'x'}));
    expect(wave({weight: 'uniform'})).toBe(wave({weight: 'uniform', axis: 'y'}));
    expect(wave({weight: 'top'})).not.toBe(wave({weight: 'uniform'}));
    expect(wave({weight: 'top', axis: 'z'})).not.toBe(wave({weight: 'top'}));
    expect(Object.isFrozen(wave({weight: 'top'}))).toBe(true);
  });

  test('is named wave in every form, requires the instance position and runs at MeshOrder.Offset', () => {
    for (const options of [{weight: 'top'}, {weight: 'uniform'}, {weight: 'uniform', axis: 'z'}] as WaveOptions[]) {
      const feature = wave(options);
      expect(feature.name).toBe('wave');
      expect(feature.requires).toEqual(['instancePosition']);
      expect(feature.mesh!.order).toBe(MeshOrder.Offset);
    }
  });

  test('declares its three uniforms and the time AnimatedFrames shares', () => {
    expect(wave({weight: 'top'}).uniforms).toEqual({
      waveAmplitude: 1,
      waveFrequency: 1,
      waveSpeed: 1,
      time: {value: 0, shared: true},
    });
  });

  test('refuses options that are no object, a missing or unknown weight and an unknown axis', () => {
    const takes =
      "wave: takes {weight: 'top' | 'uniform'} — wave({weight: 'top'}) sways grass, wave({weight: 'uniform'}) moves the glyphs of a scroller";
    expect(() => wave(undefined as unknown as WaveOptions)).toThrow(new TypeError(takes));
    expect(() => wave('top' as unknown as WaveOptions)).toThrow(new TypeError(takes));
    expect(() => wave({} as WaveOptions)).toThrow(new TypeError(takes));
    expect(() => wave({weight: 'bottom'} as unknown as WaveOptions)).toThrow(
      new TypeError(`wave: the weight "bottom" is neither 'top' nor 'uniform'`),
    );
    expect(() => wave({weight: 'top', axis: 'w'} as unknown as WaveOptions)).toThrow(
      new TypeError(`wave: the axis "w" is none of 'x', 'y', 'z'`),
    );
  });

  test("'top' moves a vertex along x by the amplitude times the square of how high it lies", () => {
    const sway = wave({weight: 'top'});
    // phase 2π · (1 · 0 − 1 · (−0.25)) = π/2: the sine is 1
    const at = (v: number) => waved(sway, [1, 2, 3], {instancePosition: [0, 0, 0], uv: [0.5, v], waveAmplitude: 4, time: -0.25});

    expectClose(at(0), [5, 2, 3]);
    expectClose(at(0.5), [2, 2, 3]);
    expectClose(at(1), [1, 2, 3]);
  });

  test("'uniform' moves every vertex along y by the amplitude", () => {
    const scroller = wave({weight: 'uniform'});
    const at = (v: number) =>
      waved(scroller, [1, 2, 3], {instancePosition: [0, 0, 0], uv: [0, v], waveAmplitude: 4, time: -0.25});

    expectClose(at(0), [1, 6, 3]);
    expectClose(at(1), [1, 6, 3]);
  });

  test('moves along the axis it is given', () => {
    const values: Values = {instancePosition: [0, 0, 0], uv: [0, 0], waveAmplitude: 2, time: -0.25};

    expectClose(waved(wave({weight: 'top', axis: 'y'}), [0, 0, 0], values), [0, 2, 0]);
    expectClose(waved(wave({weight: 'top', axis: 'z'}), [0, 0, 0], values), [0, 0, 2]);
    expectClose(waved(wave({weight: 'uniform', axis: 'x'}), [0, 0, 0], values), [2, 0, 0]);
  });

  test('takes its phase from x + z of the instance position, in waves per unit, and runs towards +x', () => {
    const scroller = wave({weight: 'uniform'});
    const offsetAt = (x: number, z: number, time = 0) =>
      waved(scroller, [0, 0, 0], {instancePosition: [x, 7, z], uv: [0, 0], waveFrequency: 0.25, time, waveSpeed: 0.5})[1]!;

    // a quarter wave per unit: one unit along x or z is a quarter turn, y counts nothing
    expect(offsetAt(1, 0)).toBeCloseTo(1, 6);
    expect(offsetAt(0, 1)).toBeCloseTo(1, 6);
    expect(offsetAt(2, 0)).toBeCloseTo(0, 6);
    expect(offsetAt(3, 0)).toBeCloseTo(-1, 6);
    // half a wave per second: after a second the crest at x = 1 has moved 2 units on, to x = 3
    expect(offsetAt(3, 0, 1)).toBeCloseTo(1, 6);
  });

  test('holds one time with AnimatedFrames in a kind', () => {
    const kind = defineSprite({
      base: QuadBase,
      features: [InstancePosition, FlatPlacement, AnimatedFrames, TextureColor, wave({weight: 'top'})],
    });
    const material = new FeatureSpritesMaterial(kind);

    material.setUniform('time', 2.5);

    expect(Object.keys(material.uniforms).sort()).toEqual(['time', 'waveAmplitude', 'waveFrequency', 'waveSpeed']);
    expect(material.uniforms['time']!.value).toBe(2.5);
    material.dispose();
  });

  test('builds the position graph of a kind', () => {
    const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, wave({weight: 'uniform'})]});
    const material = new FeatureSpritesMaterial(kind);

    expect(material.positionNode).not.toBeNull();
    material.dispose();
  });

  test('a second wave in one kind is refused, naming the fix', () => {
    expect(() =>
      defineSprite({
        base: QuadBase,
        features: [InstancePosition, FlatPlacement, wave({weight: 'top'}), wave({weight: 'uniform'})],
      }),
    ).toThrow(
      'defineSprite: feature "wave": a kind takes one wave — pick one weight and one axis, or write a mesh stage of your own for a second motion',
    );
    expect(() =>
      defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, wave({weight: 'top'}), wave({weight: 'top'})]}),
    ).toThrow('defineSprite: feature "wave": a kind takes one wave');
  });

  test('one wave passes its own check', () => {
    expect(() => wave({weight: 'top'}).checkKind!({base: QuadBase, features: [wave({weight: 'top'})]})).not.toThrow();
  });
});
