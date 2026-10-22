import {add, mix, mul, sin, sub, vec3} from 'three/tsl';
import {describeValue} from '../../utils/describeValue.js';
import {defineFeature, MeshOrder, type SpriteFeature} from '../SpriteFeature.js';

export interface WaveOptions {
  /**
   * `'top'` sways the sprite — grass, flags, seaweed: the top moves by the full amount, the foot
   * stays, weighted by `(1 − uv.y)²` of the base uv, so a sprite on `gridBase()` bends where one on
   * the quad shears. It is the top of the image: under `flipY` the bottom of the quad sways.
   * `'uniform'` moves the whole sprite — the glyphs of a sine scroller.
   */
  readonly weight: 'top' | 'uniform';
  /** The axis of the mesh the vertices move along: `'x'` for `'top'`, `'y'` for `'uniform'` by default. */
  readonly axis?: 'x' | 'y' | 'z';
}

const WEIGHTS: readonly string[] = ['top', 'uniform'];
const AXES: readonly string[] = ['x', 'y', 'z'];

// one feature per set of options, as flatPlacement() keeps its placements
const waves = new Map<string, SpriteFeature>();

/**
 * Moves the placed vertex along an axis of the mesh by a sine of time and of the instance position,
 * a mesh stage at `MeshOrder.Offset`:
 *
 * ```text
 * phase  = 2π · (waveFrequency · (x + z of instancePosition) − waveSpeed · time)
 * vertex = vertex + axis · waveAmplitude · weight · sin(phase)
 * ```
 *
 * `waveAmplitude` is in units of the mesh, `waveFrequency` in waves per unit, `waveSpeed` in waves
 * per second; the wave runs towards +x. The uniforms belong to the kind and start at 1; `time` is
 * declared shared, so next to `AnimatedFrames` one `setUniform('time', t)` drives both.
 *
 * Returns one frozen feature per set of options, every one named `wave` — a kind takes one wave, and
 * `defineSprite()` refuses a second, naming the fix.
 *
 * @throws a `TypeError` for options without a weight, and for a weight or an axis it does not know
 */
export function wave(options: WaveOptions): SpriteFeature {
  if (options == null || typeof options !== 'object' || options.weight === undefined) {
    throw new TypeError(
      "wave: takes {weight: 'top' | 'uniform'} — wave({weight: 'top'}) sways grass, wave({weight: 'uniform'}) moves the glyphs of a scroller",
    );
  }
  const {weight} = options;
  if (!WEIGHTS.includes(weight)) {
    throw new TypeError(`wave: the weight ${describeValue(weight)} is neither 'top' nor 'uniform'`);
  }
  const axis = options.axis ?? (weight === 'top' ? 'x' : 'y');
  if (!AXES.includes(axis)) {
    throw new TypeError(`wave: the axis ${describeValue(axis)} is none of 'x', 'y', 'z'`);
  }

  const key = `${weight}+${axis}`;
  let feature = waves.get(key);
  if (feature == null) {
    feature = defineFeature({
      name: 'wave',
      requires: ['instancePosition'],
      // asked by defineSprite() when a second feature named wave is listed, before the plain refusal
      checkKind: ({features}) => {
        if (features.filter(({name}) => name === 'wave').length > 1) {
          throw new Error(
            'a kind takes one wave — pick one weight and one axis, or write a mesh stage of your own for a second motion',
          );
        }
      },
      // shared: the time of AnimatedFrames, a bob or another feature of the kind is the wave's
      uniforms: {waveAmplitude: 1, waveFrequency: 1, waveSpeed: 1, time: {value: 0, shared: true}},
      mesh: {
        order: MeshOrder.Offset,
        transform: (position, {attribute, uniform, frame}) => {
          const instance = attribute<'vec3'>('instancePosition');
          const along = add(instance.x, instance.z);
          const phase = mul(
            2 * Math.PI,
            sub(mul(uniform<'float'>('waveFrequency'), along), mul(uniform<'float'>('waveSpeed'), uniform<'float'>('time'))),
          );
          let amount = mul(uniform<'float'>('waveAmplitude'), sin(phase));
          if (weight === 'top') {
            // the square of the height on the image: a linear weight would shear a grid as it shears
            // the quad. Upside down — Flip — the top of the image lies at the bottom of the quad, and
            // that end sways: a vine hanging from a ceiling
            const down = attribute<'vec2'>('uv').y;
            const height = sub(1, frame.mirror != null ? mix(down, sub(1, down), frame.mirror.y) : down);
            amount = mul(amount, mul(height, height));
          }
          const offset = axis === 'x' ? vec3(amount, 0, 0) : axis === 'y' ? vec3(0, amount, 0) : vec3(0, 0, amount);
          return add(position, offset);
        },
      },
    });
    waves.set(key, feature);
  }
  return feature;
}
