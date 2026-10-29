import {
  crossfade,
  dipToColor,
  dissolve,
  iris,
  lumaMask,
  pixelate,
  slide,
  type StageTransitionEffect,
  wipe,
} from '@spearwolf/twopoint5d';
import {float, mix, sin, vec2} from 'three/tsl';
import {CanvasTexture, Color, type Texture} from 'three/webgpu';

/**
 * An effect of one's own, as in "Stage transitions" of `docs/stages.md`: both pictures wave
 * sideways, strongest in the middle of the transition, while one turns into the other.
 */
export const wobble = (amplitude = 0.03): StageTransitionEffect => ({
  name: 'wobble',
  build: ({from, to, progress, uv}) => {
    const strength = sin(progress.mul(Math.PI)).mul(amplitude);
    const shifted = uv.add(vec2(sin(uv.y.mul(40)).mul(strength), float(0)));
    return mix(from.sample(shifted), to.sample(shifted), progress);
  },
});

/** A gray mask on a 2D canvas, drawn by `paint` into a square of `size` pixels. */
function maskTexture(paint: (ctx: CanvasRenderingContext2D, size: number) => void): Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d')!, size);
  return new CanvasTexture(canvas);
}

/** The three masks of the gallery: a radial gradient, diagonal stripes and a spiral. */
export function makeMasks(): Record<'radial' | 'stripes' | 'spiral', Texture> {
  return {
    radial: maskTexture((ctx, size) => {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.71);
      g.addColorStop(0, '#000');
      g.addColorStop(1, '#fff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }),
    stripes: maskTexture((ctx, size) => {
      // eight bands, each a gradient of its own, and the bands themselves darker to the top left
      const image = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const d = (x + y) / (2 * size);
          const band = (d * 8) % 1;
          const v = Math.min(1, band * 0.6 + d * 0.4);
          const i = (y * size + x) * 4;
          image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(v * 255);
          image.data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    }),
    spiral: maskTexture((ctx, size) => {
      const image = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - size / 2;
          const dy = y - size / 2;
          const angle = (Math.atan2(dy, dx) / (2 * Math.PI) + 0.5) % 1;
          const radius = Math.hypot(dx, dy) / (size * 0.71);
          const v = (angle * 0.5 + radius * 0.5 + radius * 2) % 1;
          const i = (y * size + x) * 4;
          image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(v * 255);
          image.data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    }),
  };
}

/**
 * The effects of the demos by the name the menus show. Each one is made once: an effect object is a
 * description the director keeps a graph for, so the second transition with it builds no shader.
 */
export function makeEffects(masks?: Record<'radial' | 'stripes' | 'spiral', Texture>): Map<string, StageTransitionEffect> {
  const effects = new Map<string, StageTransitionEffect>([
    ['crossfade', crossfade()],
    ['dip to black', dipToColor({color: new Color('#000')})],
    ['dip to white', dipToColor({color: new Color('#fff')})],
    ['wipe left', wipe({direction: 'left'})],
    ['wipe diagonal', wipe({direction: Math.PI / 4, softness: 0.15})],
    ['slide push', slide({direction: 'left', mode: 'push'})],
    ['slide cover', slide({direction: 'up', mode: 'cover'})],
    ['slide reveal', slide({direction: 'down', mode: 'reveal'})],
    ['iris', iris({softness: 0.04})],
    ['dissolve', dissolve({scale: 4})],
    ['pixel dissolve', dissolve()],
    ['pixelate', pixelate({maxBlockSize: 40})],
  ]);
  if (masks) {
    effects.set('luma mask: radial', lumaMask({mask: masks.radial, softness: 0.1}));
    effects.set('luma mask: stripes', lumaMask({mask: masks.stripes, softness: 0.05}));
    effects.set('luma mask: spiral', lumaMask({mask: masks.spiral, softness: 0.08}));
  }
  effects.set('wobble (custom)', wobble());
  return effects;
}
