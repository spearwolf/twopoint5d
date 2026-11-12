import type {StagePostProcess} from '@spearwolf/twopoint5d';
import {
  abs,
  dot,
  float,
  fract,
  max,
  mix,
  screenCoordinate,
  screenSize,
  screenUV,
  sin,
  smoothstep,
  time,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type {Node} from 'three/webgpu';

// The looks of the demo: each one is a `StagePostProcess`, a description of an effect on one stage.
// `build()` gets the scene pass of the stage and answers the node the stage draws instead. None of
// them keeps anything of a build, so one object serves both rooms of the demo.

const luminance = (color: Node<'vec4'>): Node<'float'> => dot(color.rgb, vec3(0.299, 0.587, 0.114));

/** A value in 0…1 from a position on the screen, different for every pixel and every call. */
const grainAt = (p: Node<'vec2'>): Node<'float'> => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));

/**
 * The room as an etching: an outline where the brightness of the picture changes, and hatching that
 * grows denser with every step into the dark — one set of lines, then a second across it, then a
 * third, then solid ink — on paper.
 */
export function etching(): StagePostProcess {
  return {
    build: ({pass}) => {
      const picture = pass.getTextureNode();
      const texel = vec2(1, 1).div(screenSize);
      // the tone the hatching follows: the room is dark, so its shadows are spread over the steps
      const toneOf = (color: Node<'vec4'>): Node<'float'> => luminance(color).max(0).pow(0.45);
      const at = (dx: number, dy: number) => toneOf(picture.sample(screenUV.add(texel.mul(vec2(dx, dy)))) as Node<'vec4'>);
      const tone = toneOf(pass);

      // the outline: the change of the tone over three pixels, left to right and bottom to top
      const gx = at(1.5, 0).sub(at(-1.5, 0));
      const gy = at(0, 1.5).sub(at(0, -1.5));
      const outline = smoothstep(0.07, 0.2, gx.mul(gx).add(gy.mul(gy)).sqrt());

      // the lines are as far apart on a small canvas as on a large one
      const spacing = screenSize.y.div(105);
      const p = screenCoordinate.xy.div(spacing);
      /** 1 on a line, 0 between two: lines across `coord`, `width` of the spacing wide. */
      const lines = (coord: Node<'float'>, width: number): Node<'float'> =>
        float(1).sub(smoothstep(width, width + 0.28, abs(fract(coord).sub(0.5)).mul(2)));
      /** 1 where the picture is darker than `edge`. */
      const darker = (edge: number): Node<'float'> => float(1).sub(smoothstep(edge - 0.05, edge + 0.05, tone));

      const hatched = max(
        max(lines(p.x.add(p.y), 0.14).mul(darker(0.5)), lines(p.x.sub(p.y), 0.14).mul(darker(0.33))),
        max(lines(p.y.add(p.x.mul(0.25)).mul(1.6), 0.2).mul(darker(0.2)), darker(0.1)),
      );
      const inked = max(outline, hatched);

      const paper = vec3(0.93, 0.89, 0.79);
      const ink = vec3(0.09, 0.07, 0.09);
      // the paper is not even: a grain that stands still, and a wash where the room is dim
      const sheet = paper.mul(grainAt(screenCoordinate.xy.floor()).mul(0.05).add(0.95)).mul(darker(0.62).mul(-0.12).add(1));
      const color = mix(sheet, ink, inked.mul(0.93));

      // the alpha of the stage stays, and the color is premultiplied by it as the pass gives it
      return vec4(color.mul(pass.a), pass.a);
    },
  };
}

/**
 * The room through a night-vision scope: the brightness of the picture on a green phosphor, with
 * scan lines, a grain that crawls and a dark rim.
 */
export function nightVision(): StagePostProcess {
  return {
    build: ({pass}) => {
      const p = screenCoordinate.xy;
      const tone = luminance(pass).mul(3.2).pow(0.8);
      const scan = sin(p.y.mul(Math.PI * 0.5))
        .mul(0.1)
        .add(0.9);
      const grain = grainAt(p.floor().add(time.mul(24).floor().mul(17)))
        .mul(0.16)
        .add(0.92);
      const fromCenter = screenUV.sub(0.5);
      const rim = float(1).sub(smoothstep(0.18, 0.62, dot(fromCenter, fromCenter).mul(1.6)));
      const phosphor = vec3(0.24, 1.0, 0.42).mul(tone.mul(scan).mul(grain).mul(rim));
      // a glare where the scope clips
      const color = phosphor.add(vec3(0.6, 0.6, 0.6).mul(smoothstep(0.85, 1.4, tone)));
      return vec4(color.mul(pass.a), pass.a);
    },
  };
}
