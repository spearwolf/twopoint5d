import {CanvasTexture, LinearFilter, NearestFilter, SRGBColorSpace} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {forgetFrameName} from './internals.js';
import {TextureAtlas, type TextureAtlasFrame, type TextureAtlasFrameName} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';

/** The 2D context a {@link DynamicAtlas} draws with. */
export type DynamicAtlasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Draws one frame of a {@link DynamicAtlas}: the context is moved to the top left of the frame and
 * clipped to it, and `width` and `height` are the size of the frame in texels.
 */
export type DynamicAtlasDraw = (context: DynamicAtlasContext, width: number, height: number) => void;

/** An image a {@link DynamicAtlas} draws a frame from. */
export type DynamicAtlasImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

/** What a frame of a {@link DynamicAtlas} is drawn from: a draw callback or an image. */
export type DynamicAtlasSource = DynamicAtlasDraw | DynamicAtlasImage;

/** The size of a frame of a {@link DynamicAtlas}, in texels; rounded up to whole texels. */
export interface DynamicAtlasSize {
  width: number;
  height: number;
}

export interface DynamicAtlasOptions {
  /** The width of the atlas in texels — a whole number of 1 or more. Required without a `canvas`. */
  width?: number;
  /** The height of the atlas in texels — a whole number of 1 or more. Required without a `canvas`. */
  height?: number;
  /**
   * A canvas of one's own to pack the frames into. The atlas takes its size — `width` and `height` beside
   * it are refused — draws on it and leaves it the caller's: it is neither resized nor released.
   */
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  /** The clear texels between two frames and between a frame and the edge — a whole number of 0 or more. Default 1. */
  padding?: number;
  /**
   * How many texels the edge of every frame is repeated outwards, so that linear filtering at the edge
   * reads the frame and not its neighbourhood — a whole number of 0 or more. Default 0.
   */
  extrude?: number;
  /** The filter of the texture, for magnification and minification. Default `'linear'`. */
  filter?: 'linear' | 'nearest';
}

// a row of cells, as high as the cell that opened it; `x` is where the next cell begins
interface Shelf {
  readonly y: number;
  readonly height: number;
  x: number;
}

// where a frame lies in the canvas, its extruded edges not included
interface FrameRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const WHERE = 'DynamicAtlas';

const isWhole = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min;

const assertWhole = (value: unknown, min: number, what: string): number => {
  if (!isWhole(value, min)) {
    throw new RangeError(`${WHERE}: the ${what} must be a whole number of ${min} or more, got ${describeValue(value)}`);
  }
  return value;
};

const nameOf = (name: TextureAtlasFrameName): string => name.toString();

// the size an image is drawn at by itself: the natural size of an image element, the size of the rest
const sizeOfImage = (image: DynamicAtlasImage): {width: number; height: number} =>
  'naturalWidth' in image ? {width: image.naturalWidth, height: image.naturalHeight} : {width: image.width, height: image.height};

const buildCanvas = (width: number, height: number): HTMLCanvasElement | OffscreenCanvas => {
  // an OffscreenCanvas first: every current browser has one, also in a worker, and it is no DOM node
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined' && document != null) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error(
    `${WHERE}: there is no OffscreenCanvas and no document to build a canvas — hand one in: new DynamicAtlas({canvas})`,
  );
};

/**
 * An atlas packed at run time: frames drawn into a canvas — by a callback, or from an image — on
 * shelves, one `CanvasTexture` for all of them, and an ordinary {@link TextureAtlas} of their frames,
 * so `setFrame()`, `AtlasFrameTable` and `sampleAtlasFrame()` read them as any other.
 *
 * The texture is read upright (`flipY = false`, as every atlas of the library), in sRGB, with
 * straight alpha and without mipmaps. `add()`, `redraw()`, `remove()` and `clear()` mark it for
 * upload: the renderer uploads the whole canvas once with the next render that uses it.
 *
 * The atlas owns its texture and a canvas it built itself; {@link dispose} releases both. A canvas
 * handed in stays the caller's.
 */
export class DynamicAtlas {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly extrude: number;

  readonly #canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly #ownsCanvas: boolean;
  readonly #context: DynamicAtlasContext;
  readonly #texture: CanvasTexture<HTMLCanvasElement | OffscreenCanvas>;
  // the canvas as a whole: the parent of the coords of every frame
  readonly #root: TextureCoords;

  #atlas = new TextureAtlas();
  // where each frame lies in the canvas, kept apart from its `data`: a caller may change that, and redraw()
  // and remove() still clear and draw the cell the frame was packed into
  #cells = new Map<TextureAtlasFrame, FrameRect>();
  #shelves: Shelf[] = [];
  #disposed = false;

  /**
   * @throws {TypeError} without a size and without a canvas, for a size beside a canvas, for a filter it
   *   does not know, and for a canvas that gives no 2D context.
   * @throws {RangeError} for a size that is no whole number of 1 or more, and a `padding` or `extrude`
   *   that is no whole number of 0 or more.
   * @throws {Error} where there is no `OffscreenCanvas` and no `document` to build a canvas — Node.
   */
  constructor(options: DynamicAtlasOptions) {
    const {canvas, padding = 1, extrude = 0, filter = 'linear'} = options;

    let width: number;
    let height: number;
    if (canvas != null) {
      if (options.width !== undefined || options.height !== undefined) {
        throw new TypeError(`${WHERE}: the size comes from the canvas handed in — leave out width and height`);
      }
      width = assertWhole(canvas.width, 1, 'width of the canvas');
      height = assertWhole(canvas.height, 1, 'height of the canvas');
    } else {
      if (options.width === undefined || options.height === undefined) {
        throw new TypeError(`${WHERE}: give the size of the atlas — new DynamicAtlas({width: 1024, height: 1024})`);
      }
      width = assertWhole(options.width, 1, 'width');
      height = assertWhole(options.height, 1, 'height');
    }
    this.padding = assertWhole(padding, 0, 'padding');
    this.extrude = assertWhole(extrude, 0, 'extrude');
    if (filter !== 'linear' && filter !== 'nearest') {
      throw new TypeError(`${WHERE}: the filter ${describeValue(filter)} is neither 'linear' nor 'nearest'`);
    }
    this.width = width;
    this.height = height;
    this.#root = new TextureCoords(0, 0, width, height);

    this.#canvas = canvas ?? buildCanvas(width, height);
    this.#ownsCanvas = canvas == null;
    // the union of both canvas types has no getContext() that TypeScript can call with '2d'
    const context = (this.#canvas as HTMLCanvasElement).getContext('2d') as DynamicAtlasContext | null;
    if (context == null) {
      throw new TypeError(
        `${WHERE}: the canvas handed in gives no 2D context — it holds a context of another kind; hand in a fresh canvas`,
      );
    }
    this.#context = context;

    const texture = new CanvasTexture(this.#canvas);
    texture.name = 'twopoint5d.DynamicAtlas';
    // the convention of every atlas of the library: v counts downwards, as TextureCoords do
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    // the canvas keeps its texels premultiplied; both backends hand them on unpremultiplied with this
    texture.premultiplyAlpha = false;
    // every change uploads the whole canvas, and the small mip levels of a packed atlas mix its frames
    texture.generateMipmaps = false;
    texture.magFilter = filter === 'nearest' ? NearestFilter : LinearFilter;
    texture.minFilter = filter === 'nearest' ? NearestFilter : LinearFilter;
    this.#texture = texture;
  }

  /** The frames of the atlas — an ordinary `TextureAtlas`, and a new one after {@link clear}. Still answers after {@link dispose}. */
  get atlas(): TextureAtlas {
    return this.#atlas;
  }

  /**
   * The texture of the canvas, built once and never replaced; the atlas owns it.
   *
   * @throws {Error} once the atlas is disposed.
   */
  get texture(): CanvasTexture<HTMLCanvasElement | OffscreenCanvas> {
    this.#assertAlive('texture');
    return this.#texture;
  }

  /**
   * The canvas the frames are drawn into.
   *
   * @throws {Error} once the atlas is disposed.
   */
  get canvas(): HTMLCanvasElement | OffscreenCanvas {
    this.#assertAlive('canvas');
    return this.#canvas;
  }

  /**
   * The 2D context of the canvas — to measure a text before it is added (`context.measureText()`, with the
   * `font` set). Draw through {@link add} and {@link redraw}: they clip, move and clear the cell of a frame.
   * The atlas draws in canvas pixels whatever transform, alpha or compositing is left on it, and gives that
   * state back afterwards.
   *
   * @throws {Error} once the atlas is disposed.
   */
  get context(): DynamicAtlasContext {
    this.#assertAlive('context');
    return this.#context;
  }

  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Packs a frame onto the shelves, draws `source` into it and adds it to {@link atlas} under `name`.
   * Answers the frame: untrimmed, its `data` the rectangle in the canvas as a TexturePacker entry,
   * `{frame: {x, y, w, h}}`.
   *
   * A draw callback needs the `size`; it runs clipped to the frame and moved to its top left, the cell
   * cleared, and the context is restored afterwards. An image is drawn at its own size — the natural
   * size of an image element — or scaled to `size`. A size is rounded up to whole texels.
   *
   * A frame that does not fit is refused, and a callback that throws leaves the atlas as it was: in
   * both cases no frame is added and no cell is taken.
   *
   * @throws {Error} for a name that is taken, an image element that has not loaded — with or without a
   *   size —, a frame that does not fit (a `RangeError`), and once the atlas is disposed.
   * @throws {RangeError} for a size that is no finite number above 0.
   * @throws {TypeError} for a draw callback without a size.
   */
  add(name: TextureAtlasFrameName, draw: DynamicAtlasDraw, size: DynamicAtlasSize): TextureAtlasFrame;
  add(name: TextureAtlasFrameName, image: DynamicAtlasImage, size?: DynamicAtlasSize): TextureAtlasFrame;
  add(name: TextureAtlasFrameName, source: DynamicAtlasSource, size?: DynamicAtlasSize): TextureAtlasFrame {
    this.#assertAlive('add()');
    if (this.#atlas.frameId(name) !== undefined) {
      throw new Error(
        `${WHERE}: the frame name "${nameOf(name)}" is already taken — redraw() draws it anew, remove() lets go of it`,
      );
    }
    const {width, height} = this.#sizeOf(name, source, size);

    const rollback = this.#pack(name, width, height);
    const rect: FrameRect = {x: rollback.x + this.extrude, y: rollback.y + this.extrude, w: width, h: height};
    try {
      this.#draw(rect, source);
    } catch (error) {
      this.#clearCell(rect);
      rollback.undo();
      throw error;
    }

    const id = this.#atlas.add(name, new TextureCoords(this.#root, rect.x, rect.y, width, height), {
      frame: {x: rect.x, y: rect.y, w: width, h: height},
    });
    this.#texture.needsUpdate = true;
    // the frame was added under this id just now
    const frame = this.#atlas.get(id)!;
    this.#cells.set(frame, rect);
    return frame;
  }

  /**
   * Draws the frame `name` anew: clears its cell and draws `source` into it at the size of the frame — a
   * callback with that size, an image scaled to it — and extrudes it again. The frame keeps its object,
   * its id and its coords, so every sprite that shows it shows the new picture after the next upload,
   * without a write to it.
   *
   * A draw callback or an image that throws leaves the frame as far as it got — its cell cleared, perhaps
   * drawn in part — and marked for upload; the frame, its name and its cell stay, and the error goes on to
   * the caller. An image element that has not loaded is refused before anything is cleared.
   *
   * @throws {Error} for a name the atlas does not hold, an image element that has not loaded, and once the
   *   atlas is disposed.
   */
  redraw(name: TextureAtlasFrameName, source: DynamicAtlasSource): TextureAtlasFrame {
    this.#assertAlive('redraw()');
    const frame = this.#atlas.frame(name);
    const rect = frame === undefined ? undefined : this.#cells.get(frame);
    if (frame === undefined || rect === undefined) {
      throw new Error(`${WHERE}: there is no frame "${nameOf(name)}" to redraw — add() it first`);
    }
    if (typeof source !== 'function') this.#assertLoaded(name, source, 'redraw()');
    try {
      this.#draw(rect, source);
    } finally {
      // the cell was cleared at the least, so the canvas changed whether the draw went through or not
      this.#texture.needsUpdate = true;
    }
    return frame;
  }

  /**
   * Clears the cell of the frame `name` and lets go of the name: {@link atlas} finds it no longer, and
   * `add()` may take it again — for a new cell. The cell is not reused, shelves fragment; the frame keeps
   * its id, and `atlas.get(id)` still answers it. Answers `false` for a name the atlas does not hold, and
   * once the atlas is disposed.
   */
  remove(name: TextureAtlasFrameName): boolean {
    if (this.#disposed) return false;
    const frame = this.#atlas.frame(name);
    const rect = frame === undefined ? undefined : this.#cells.get(frame);
    if (frame === undefined || rect === undefined) return false;
    this.#clearCell(rect);
    this.#cells.delete(frame);
    this.#atlas[forgetFrameName](name);
    this.#texture.needsUpdate = true;
    return true;
  }

  /**
   * Clears the canvas and the shelves and starts a new {@link atlas}: its frame ids begin at 0 again, and
   * the frames of before — and every table or prepared frame made of them — are stale. The texture and the
   * canvas stay the same objects. Does nothing once the atlas is disposed.
   */
  clear(): void {
    if (this.#disposed) return;
    this.#inCanvasPixels(() => this.#context.clearRect(0, 0, this.width, this.height));
    this.#shelves = [];
    this.#atlas = new TextureAtlas();
    this.#cells = new Map();
    this.#texture.needsUpdate = true;
  }

  /**
   * Disposes the texture and shrinks a canvas the atlas built itself to 0 × 0; a canvas handed in is left
   * alone. Afterwards `texture`, `canvas` and `context` throw, and so do `add()` and `redraw()`;
   * `remove()` answers `false` and `clear()` does nothing; `atlas` and the sizes answer what they held.
   * A second call does nothing.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#texture.dispose();
    if (this.#ownsCanvas) {
      this.#canvas.width = 0;
      this.#canvas.height = 0;
    }
  }

  #assertAlive(member: string): void {
    if (this.#disposed) {
      throw new Error(`${WHERE}#${member} is not available: this atlas has been disposed`);
    }
  }

  #sizeOf(
    name: TextureAtlasFrameName,
    source: DynamicAtlasSource,
    size: DynamicAtlasSize | undefined,
  ): {width: number; height: number} {
    if (typeof source === 'function' && size == null) {
      throw new TypeError(
        `${WHERE}: add("${nameOf(name)}") with a draw callback needs the size — add(name, draw, {width, height})`,
      );
    }
    if (typeof source !== 'function') {
      // with a size as well: drawImage() draws nothing of an image that has not loaded, and the frame
      // would stay empty for good
      const natural = this.#assertLoaded(name, source, 'add()');
      if (size == null) return natural;
    }
    const given = size as DynamicAtlasSize;
    const check = (value: unknown, what: string): number => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new RangeError(
          `${WHERE}: the ${what} of the frame "${nameOf(name)}" must be a finite number above 0, got ${describeValue(value)}`,
        );
      }
      return Math.ceil(value);
    };
    return {width: check(given.width, 'width'), height: check(given.height, 'height')};
  }

  // Takes a cell for a frame of `width` × `height` off the shelves and answers its top left corner and
  // the way to give it back. Throws, changing nothing, for a frame that does not fit
  #pack(name: TextureAtlasFrameName, width: number, height: number): {x: number; y: number; undo: () => void} {
    const {padding, extrude} = this;
    const cellWidth = width + 2 * extrude;
    const cellHeight = height + 2 * extrude;

    if (cellWidth + 2 * padding > this.width || cellHeight + 2 * padding > this.height) {
      throw new RangeError(
        `${WHERE}: the frame "${nameOf(name)}" of ${width} × ${height} does not fit into an atlas of ${this.width} × ${this.height} with padding ${padding} and extrude ${extrude} — build a larger atlas`,
      );
    }

    // the lowest shelf the cell fits onto, the first of equal ones
    let best: Shelf | undefined;
    for (const shelf of this.#shelves) {
      if (shelf.height < cellHeight || shelf.x + cellWidth + padding > this.width) continue;
      if (best === undefined || shelf.height < best.height) best = shelf;
    }
    if (best !== undefined) {
      const shelf = best;
      const x = shelf.x;
      shelf.x += cellWidth + padding;
      return {
        x,
        y: shelf.y,
        undo: () => {
          shelf.x = x;
        },
      };
    }

    const last = this.#shelves.at(-1);
    const y = last === undefined ? padding : last.y + last.height + padding;
    if (y + cellHeight + padding > this.height) {
      const count = this.#atlas.size;
      throw new RangeError(
        `${WHERE}: the atlas of ${this.width} × ${this.height} is full — the frame "${nameOf(name)}" of ${width} × ${height} does not fit beside ${count === 1 ? 'the 1 frame' : `the ${count} frames`} packed into it; build a larger one — new DynamicAtlas({width: ${2 * this.width}, height: ${2 * this.height}}) — or clear() it`,
      );
    }
    const shelf: Shelf = {y, height: cellHeight, x: padding + cellWidth + padding};
    this.#shelves.push(shelf);
    return {
      x: padding,
      y,
      undo: () => {
        this.#shelves.pop();
      },
    };
  }

  // The natural size of an image, refused for an image element that has not loaded: one whose natural
  // size is still 0, and one that is still loading — the browser knows the size of an image once it is
  // "partially available", before the last of it has arrived. Only an image element carries `complete`;
  // an ImageBitmap and a canvas have none and are there as soon as they exist
  #assertLoaded(name: TextureAtlasFrameName, image: DynamicAtlasImage, call: string): {width: number; height: number} {
    const natural = sizeOfImage(image);
    if (!(natural.width > 0) || !(natural.height > 0) || ('complete' in image && image.complete === false)) {
      throw new Error(`${WHERE}: the image of "${nameOf(name)}" has not loaded yet — await image.decode() before ${call}`);
    }
    return natural;
  }

  // Runs `work` with the context saved and set to canvas pixels: no transform, full alpha, plain
  // compositing — whatever the caller left on the context, which `context` hands out for measureText() —
  // and restored afterwards, so the caller's state, its font among it, comes back
  #inCanvasPixels(work: () => void): void {
    const context = this.#context;
    context.save();
    try {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      work();
    } finally {
      context.restore();
    }
  }

  #clearCell({x, y, w, h}: FrameRect): void {
    const e = this.extrude;
    this.#inCanvasPixels(() => this.#context.clearRect(x - e, y - e, w + 2 * e, h + 2 * e));
  }

  #draw(rect: FrameRect, source: DynamicAtlasSource): void {
    const context = this.#context;
    const {x, y, w, h} = rect;
    this.#clearCell(rect);
    this.#inCanvasPixels(() => {
      context.beginPath();
      context.rect(x, y, w, h);
      context.clip();
      context.translate(x, y);
      if (typeof source === 'function') {
        source(context, w, h);
      } else {
        context.drawImage(source, 0, 0, w, h);
      }
    });
    this.#extrudeEdges(rect);
  }

  // the outermost rows and columns copied outwards, the canvas drawn onto itself: left and right first,
  // then top and bottom across the extruded corners, which they fill from the corner texels
  #extrudeEdges({x, y, w, h}: FrameRect): void {
    const e = this.extrude;
    if (e === 0) return;
    const context = this.#context;
    const canvas = this.#canvas;
    this.#inCanvasPixels(() => {
      context.imageSmoothingEnabled = false;
      context.drawImage(canvas, x, y, 1, h, x - e, y, e, h);
      context.drawImage(canvas, x + w - 1, y, 1, h, x + w, y, e, h);
      context.drawImage(canvas, x - e, y, w + 2 * e, 1, x - e, y - e, w + 2 * e, e);
      context.drawImage(canvas, x - e, y + h - 1, w + 2 * e, 1, x - e, y + h, w + 2 * e, e);
    });
  }
}
