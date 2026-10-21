import {type BitmapFont, type DynamicAtlasDraw, layoutText} from '@spearwolf/twopoint5d';

const SHADOW = '#14101a';

/**
 * Draws labels with the bitmap font into frames of a `DynamicAtlas`: `layoutText()` places the
 * glyphs, and the draw callback copies them out of the font's page, a dark drop shadow first and
 * the colour on top. A label costs one sprite however long it is, and a `redraw()` changes it
 * without touching that sprite.
 */
export class PixelLabels {
  readonly #font: BitmapFont;
  readonly #page: HTMLImageElement;
  // the white page of the font, recoloured once per colour a label asks for
  readonly #tinted = new Map<string, OffscreenCanvas>();

  constructor(font: BitmapFont, page: HTMLImageElement) {
    this.#font = font;
    this.#page = page;
  }

  /** The frame size of a label as wide as `text`: the glyphs plus one pixel of shadow. */
  sizeOf(text: string): {width: number; height: number} {
    const {width, height} = layoutText(this.#font, text);
    return {width: width + 1, height};
  }

  /** A draw callback for `DynamicAtlas#add()` and `redraw()`: `text` in `color`, left aligned. */
  draw(text: string, color: string): DynamicAtlasDraw {
    return (context) => {
      // the glyph boxes in pixels of the font, y up from the top of the line: y = 0 is the top
      // row of the frame, and a box at y = -2 starts two rows below it
      const {glyphs} = layoutText(this.#font, text);
      context.imageSmoothingEnabled = false;
      for (const [page, offset] of [
        [this.#tint(SHADOW), 1],
        [this.#tint(color), 0],
      ] as const) {
        for (const {glyph, x, y, width, height} of glyphs) {
          context.drawImage(page, glyph.x, glyph.y, width, height, x + offset, -y + offset, width, height);
        }
      }
    };
  }

  #tint(color: string): OffscreenCanvas {
    let canvas = this.#tinted.get(color);
    if (canvas == null) {
      canvas = new OffscreenCanvas(this.#page.naturalWidth, this.#page.naturalHeight);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(this.#page, 0, 0);
      // keep the alpha of the glyphs, take the colour of the label
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this.#tinted.set(color, canvas);
    }
    return canvas;
  }
}
