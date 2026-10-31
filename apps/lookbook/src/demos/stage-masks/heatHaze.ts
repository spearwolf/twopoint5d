import type {StageMask, StageTransitionEffect} from '@spearwolf/twopoint5d';
import {clamp, float, mix, select, sin, smoothstep, uniform, vec2, vec3, vec4} from 'three/tsl';
import type {UniformNode} from 'three/webgpu';

export interface HeatHazeOptions {
  /** the living stage of the heat: its coverage is where the air shimmers and where `to` shows */
  mask: StageMask;
  /** how far the heat bends the pictures; 1 is a shimmer of about a hundredth of the picture */
  strength?: number;
}

export interface HeatHazeEffect extends StageTransitionEffect {
  /** the strength as a uniform: written at any time, it changes no shader */
  readonly strength: UniformNode<'float', number>;
}

/** how far apart the coverage is sampled for its slope, in pixels of the drawing buffer */
const SLOPE_STEP = 8;
/** the bend along the slope of the coverage, in uv per unit of coverage difference */
const REFRACTION = 0.2;
/** the fine ripple at the edges of the heat, in uv */
const RIPPLE = 0.0028;

/**
 * An effect of the demo's own that reads a living mask through `input.mask()`: hot air rising
 * between `from` and `to`. The coverage of the mask does two things at once:
 *
 * - **It bends both pictures.** The slope of the coverage — sampled at the neighbouring pixels —
 *   is the gradient of the hot air's density, and the uv is pushed along it: refraction, strongest
 *   at the edges of the plumes, where the coverage changes fastest. A ripple whose phase is the
 *   coverage itself adds the fine shimmer; it crawls as the plumes rise, with no clock of its own.
 * - **It is the share of `to`.** Where the heat is dense the new world shows through it.
 *
 * The ends hold whatever the mask draws: the bend is scaled by `sin(π·progress)` and is exactly 0
 * at progress 0 and 1, and the share is 0 at progress 0 and 1 at progress 1, closing softly over
 * the last fifth so that what the heat never reached does not jump.
 */
export function heatHaze({mask, strength = 1}: HeatHazeOptions): HeatHazeEffect {
  const strengthNode = uniform(strength) as unknown as UniformNode<'float', number>;
  return {
    name: 'heat-haze',
    masks: [mask],
    strength: strengthNode,
    build: ({from, to, progress, uv, resolution, mask: maskOf}) => {
      const heat = maskOf(mask);
      const atEnd = progress.lessThanEqual(0).or(progress.greaterThanEqual(1));

      // the coverage here and at the four neighbours: its slope is the bend of the air
      const step = vec2(SLOPE_STEP).div(resolution);
      const dx = vec2(step.x, 0);
      const dy = vec2(0, step.y);
      const c = heat.coverage(uv);
      const slope = vec2(
        heat.coverage(uv.add(dx)).sub(heat.coverage(uv.sub(dx))),
        heat.coverage(uv.add(dy)).sub(heat.coverage(uv.sub(dy))),
      );

      // the heat's edge: 1 where the coverage is a half, 0 in clear air and in the dense core
      const edge = c.mul(float(1).sub(c)).mul(4);
      // two frequencies that never line up, so the ripple reads as shimmer and not as a pattern
      const py = uv.y.mul(resolution.y);
      const px = uv.x.mul(resolution.x);
      const ripple = vec2(
        sin(py.mul(0.071).add(c.mul(37)))
          .mul(0.6)
          .add(sin(py.mul(0.029).sub(c.mul(23))).mul(0.4)),
        sin(px.mul(0.053).add(c.mul(29)))
          .mul(0.6)
          .add(sin(px.mul(0.021).sub(c.mul(17))).mul(0.4)),
      ).mul(edge.mul(RIPPLE));

      // 0 at both ends, exactly: the pictures lie still where the transition begins and ends
      const amount = select(atEnd, float(0), sin(progress.mul(Math.PI))).mul(strengthNode);
      // the bend in uv, square on the screen: a step in x is shorter in uv on a wide picture
      const aspect = vec2(resolution.y.div(resolution.x), 1);
      const at = clamp(uv.add(slope.mul(REFRACTION).add(ripple).mul(aspect).mul(amount)), 0, 1);

      // the dense heat shows `to`; the thin air at its rim only shimmers
      const share = select(
        progress.lessThanEqual(0),
        float(0),
        select(progress.greaterThanEqual(1), float(1), mix(smoothstep(0.3, 0.9, c), float(1), smoothstep(0.8, 1, progress))),
      );
      const color = mix(from.sample(at), to.sample(at), share);

      // the rim of the heat glows faintly with the furnace, premultiplied by the picture's alpha
      const glow = edge.mul(amount).mul(0.012);
      return vec4(color.rgb.add(vec3(1, 0.42, 0.12).mul(glow).mul(color.a)), color.a);
    },
  };
}
