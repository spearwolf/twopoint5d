import type {StageMask, StageTransitionEffect} from '@spearwolf/twopoint5d';
import {clamp, float, mix, select, sin, smoothstep, uniform, vec2, vec3, vec4} from 'three/tsl';
import type {UniformNode} from 'three/webgpu';

export interface HeatHazeOptions {
  /** the living stage of the heat: its coverage is where the air shimmers and where `to` shows */
  mask: StageMask;
  /**
   * How far the heat bends the pictures. At 1, the middle of the run bends a pixel at the edge of
   * the heat by about 2 % of the picture's height as a rule, up to 5–10 % at the sharpest edges of
   * a young plume, plus a ripple of 0.3 %. The bend is measured in the picture, so it looks the
   * same at every size and every device pixel ratio.
   */
  strength?: number;
}

export interface HeatHazeEffect extends StageTransitionEffect {
  /**
   * The strength as a uniform: written at any time, it changes no shader. It is one uniform per
   * effect object, shared by every transition built from it — make one effect per director when
   * their strengths should differ (an effect with a mask serves one director anyway).
   */
  readonly strength: UniformNode<'float', number>;
}

/**
 * How far from the pixel the coverage is sampled for its slope, as a share of the picture's height
 * (in x the same distance on the screen): 8 px on the 700 px high card of the lookbook. A share of
 * the picture and not a number of pixels, so a canvas of a higher device pixel ratio samples the
 * same stretch of the heat.
 */
const SLOPE_STEP = 8 / 700;
/**
 * The bend along the slope, in picture heights per unit of slope — the slope being the change of
 * the coverage over one picture height. Chosen so the card looks as it did when the slope was a
 * raw difference over 16 px: 0.2 × 2 × 8 / 700.
 */
const REFRACTION = 0.2 * 2 * SLOPE_STEP;
/** the fine ripple at the edges of the heat, in uv */
const RIPPLE = 0.0028;
/** the frequencies of the ripple, in waves per picture height (x in the same units on the screen) */
const RIPPLE_Y = [49.7, 20.3] as const;
const RIPPLE_X = [37.1, 14.7] as const;

/**
 * An effect of the demo's own that reads a living mask through `input.mask()`: hot air rising
 * between `from` and `to`. The coverage of the mask does two things at once:
 *
 * - **It bends both pictures.** The slope of the coverage — sampled 8 px away on the card of the
 *   lookbook (a fixed share of the picture's height, so at any pixel ratio) — is the gradient of the hot air's density, and the uv is pushed along it: refraction, strongest
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

      // the width of the picture in picture heights: x and y in the same units on the screen
      const wide = resolution.x.div(resolution.y);
      // the coverage here and at four points SLOPE_STEP away (8 px on the card): the difference
      // over twice that distance is the slope of the air, in coverage per picture height
      const dx = vec2(float(SLOPE_STEP).div(wide), 0);
      const dy = vec2(0, SLOPE_STEP);
      const c = heat.coverage(uv);
      const slope = vec2(
        heat.coverage(uv.add(dx)).sub(heat.coverage(uv.sub(dx))),
        heat.coverage(uv.add(dy)).sub(heat.coverage(uv.sub(dy))),
      ).div(2 * SLOPE_STEP);

      // the heat's edge: 1 where the coverage is a half, 0 in clear air and in the dense core
      const edge = c.mul(float(1).sub(c)).mul(4);
      // two frequencies that never line up, so the ripple reads as shimmer and not as a pattern
      // — counted per picture height, so the waves keep their size on the screen at any pixel ratio
      const py = uv.y;
      const px = uv.x.mul(wide);
      const ripple = vec2(
        sin(py.mul(RIPPLE_Y[0]).add(c.mul(37)))
          .mul(0.6)
          .add(sin(py.mul(RIPPLE_Y[1]).sub(c.mul(23))).mul(0.4)),
        sin(px.mul(RIPPLE_X[0]).add(c.mul(29)))
          .mul(0.6)
          .add(sin(px.mul(RIPPLE_X[1]).sub(c.mul(17))).mul(0.4)),
      ).mul(edge.mul(RIPPLE));

      // 0 at both ends, exactly: the pictures lie still where the transition begins and ends
      const amount = select(atEnd, float(0), sin(progress.mul(Math.PI))).mul(strengthNode);
      // the bend in picture heights to uv, square on the screen: a step in x is shorter in uv on a
      // wide picture
      const aspect = vec2(float(1).div(wide), 1);
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
