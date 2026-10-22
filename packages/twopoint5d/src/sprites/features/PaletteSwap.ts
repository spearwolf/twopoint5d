import {abs, add, clamp, div, float, max, mix, mul, sRGBTransferOETF, step, sub, vec2, vec4} from 'three/tsl';
import {type Node, SRGBColorSpace} from 'three/webgpu';
import {roundHalfUp} from '../../texture/roundHalfUp.js';
import {describeValue} from '../../utils/describeValue.js';
import {asVec3} from '../typedNodes.js';
import {ColorOrder, defineFeature, type SpriteFeature} from '../SpriteFeature.js';

export interface PaletteSwapOptions {
  /** How many entries of the palette the stage compares — a whole number from 1 to 64. Default 16. */
  readonly colors?: number;
}

export interface PaletteSwapApi {
  /**
   * The row of the palette the sprite is drawn in; row 0 holds the source colours, so a new sprite shows
   * its own. Rounded to the nearest row, a half up; a row past the last draws the last, a negative one
   * row 0.
   *
   * `paletteRow` is a static attribute: a later change reaches the gpu once it is marked —
   * `spritePool.touchVO(sprite, 'paletteRow')` or `geometry.touch('paletteRow')`.
   */
  paletteRow: number;
}

// one feature per number of colours: the stage unrolls its comparisons by it
const features = new Map<number, SpriteFeature<PaletteSwapApi>>();

// two colours closer than this in every channel, in the 8-bit values of the texture data, are one
// colour: it absorbs the rounding of 8-bit texels on their way through the sampler and nothing more
const TOLERANCE = 1 / 512;

/**
 * Swaps the colours of the sprite for those of a row of the `palette`: the red goblin and the blue goblin
 * from one sheet, team colours, and — with `paletteShift` — the colour cycling of Deluxe Paint. Returns one
 * frozen feature per set of options; `paletteSwap()` is {@link PaletteSwap}.
 *
 * The `palette` is a small image read with `flipY = false`, entry `i` of row `r` its texel `(i, r)` from the
 * top left: row 0 the source colours, every row below a replacement set of the same length. A color stage
 * in the band `ColorOrder.Palette`, before `Tint`, compares the colour of the color source with the first
 * `colors` entries of row 0 — the first entry it matches within `1/512` per channel of the values of the
 * texture data wins; under an `srgb` palette both colours are encoded back to sRGB before they are compared —
 * and draws it with that entry of the sprite's `paletteRow`, its alpha kept. A colour that matches no entry
 * stays as it is.
 *
 * Colour cycling: the uniform `paletteCycle` `(first, count)` names the entries that cycle — `count` 0, the
 * default, to the end of the palette — and `paletteShift` how far: a colour of entry `i` in the range is drawn
 * with the entry `first + ((i − first + floor(paletteShift)) mod count)`.
 *
 * The colours must be exact: load the `colorMap` with `NearestFilter` and no mipmaps, without premultiplied
 * edges, and both textures in the same colour space. The feature names the `colorMap` in `nearestTextures`, so
 * the sprites say once when it is filtered otherwise. Every fragment reads `colors + 1` texels of the palette.
 *
 * @throws a `TypeError` for `colors` that is no whole number from 1 to 64
 */
export function paletteSwap(options?: PaletteSwapOptions): SpriteFeature<PaletteSwapApi> {
  const colors = options?.colors ?? 16;
  if (!(typeof colors === 'number' && Number.isInteger(colors) && colors >= 1 && colors <= 64)) {
    throw new TypeError(`paletteSwap: colors must be a whole number from 1 to 64, got ${describeValue(colors)}`);
  }
  let feature = features.get(colors);
  if (feature == null) {
    feature = defineFeature<PaletteSwapApi>({
      name: colors === 16 ? 'paletteSwap' : `paletteSwap+${colors}`,
      attributes: {paletteRow: {size: 1}},
      uniforms: {paletteShift: 0, paletteCycle: [0, 0]},
      textures: {palette: {}},
      nearestTextures: ['colorMap'],
      initialize() {
        this.paletteRow = 0;
      },
      color: {
        order: ColorOrder.Palette,
        transform: (color, {attribute, uniform, sample, textureSize, colorSpace}) => {
          const size = textureSize('palette');
          // the sampler decodes an sRGB texel to linear values, in which dark colours lie closer than 1/512:
          // both sides go back to the 8-bit values of the texture data before they are compared. The docs
          // ask for both textures in one colour space, so the one of the palette stands for both
          const encoded = colorSpace('palette') === SRGBColorSpace;
          const dataOf = (rgb: Node<'vec3'>): Node<'vec3'> => (encoded ? asVec3(sRGBTransferOETF(rgb)) : rgb);
          const colorData = dataOf(color.rgb);
          const width = size.x;
          // the centre of a texel: exact under any filter of the palette
          const entryUv = (entry: Node<'float'>, row: Node<'float'>) =>
            vec2(div(add(entry, 0.5), max(width, 1)), div(add(row, 0.5), max(size.y, 1)));

          // the comparisons unrolled, every lookup built here and no branch: the first entry that matches
          // wins, as the walk from the last entry to the first leaves it in `index`; −1 for no match
          let index: Node<'float'> = float(-1);
          for (let i = colors - 1; i >= 0; i--) {
            const source = sample('palette', entryUv(float(i), float(0)));
            const distance = abs(sub(colorData, dataOf(source.rgb)));
            const far = max(distance.x, max(distance.y, distance.z));
            // step(edge, x) is 1 for x ≥ edge: close in every channel, and an entry the palette holds
            const matches = mul(sub(1, step(TOLERANCE, far)), step(i + 0.5, width));
            index = mix(index, float(i), matches);
          }

          // the cycled entry: within [first, first + count) shifted by whole steps, the modulo by floor
          const cycle = uniform<'vec2'>('paletteCycle');
          const first = cycle.x;
          const count = mix(sub(width, first), cycle.y, step(0.5, cycle.y));
          const offset = sub(index, first);
          const inRange = mul(step(0, offset), sub(1, step(count, offset)));
          const safeCount = max(count, 1);
          const shifted = add(offset, uniform<'float'>('paletteShift').floor());
          // shifted is a whole number, and the f32 division may lie a few ULP off: on a multiple of count it
          // could floor one too low and the entry leave the range. Half a step further the quotient lies
          // 0.5 / count away from every whole number, which no ULP of the division crosses — for a negative
          // shifted as well: −3 floors to −1 and −4 to −2 at a count of 3
          const cycled = add(first, sub(shifted, mul(safeCount, div(add(shifted, 0.5), safeCount).floor())));
          const entry = mix(index, cycled, inRange);

          const row = clamp(roundHalfUp(attribute<'float'>('paletteRow')), float(0), max(sub(size.y, 1), float(0)));
          const replacement = sample('palette', entryUv(max(entry, 0), row));
          return mix(color, vec4(replacement.rgb, color.a), step(0, index));
        },
      },
    });
    features.set(colors, feature);
  }
  return feature;
}

/** The palette swap over 16 colours: `paletteSwap()`. */
export const PaletteSwap = paletteSwap();
