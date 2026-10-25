import {Box2, CanvasTexture, LinearFilter, NearestFilter, SRGBColorSpace, Vector2, type WebGPURenderer} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {expectDefined} from '../utils/expectDefined.js';
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
  /** The width of the frame in texels, rounded up to a whole texel. */
  width: number;
  /** The height of the frame in texels, rounded up to a whole texel. */
  height: number;
}

/** How a {@link DynamicAtlas} is built: its size or a canvas of one's own, the spacing of its frames and its filter. */
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
  /**
   * The filter of {@link DynamicAtlas.texture}, for magnification and minification. Default
   * `'linear'`; {@link DynamicAtlas.textureFor} answers a texture of the other one.
   */
  filter?: DynamicAtlasFilter;
}

/** The filters a {@link DynamicAtlas} reads its canvas with: for magnification and minification alike. */
export type DynamicAtlasFilter = 'linear' | 'nearest';

// a row of cells, as high as the cell that opened it; `x` is where its tail begins, `free` the cells given
// back left of it, ascending, none touching another or the tail
interface Shelf {
  readonly y: number;
  readonly height: number;
  x: number;
  readonly free: FreeSpan[];
}

// [start, end) in canvas pixels: a cell given back and the padding behind it
interface FreeSpan {
  start: number;
  end: number;
}

// where a frame lies in the canvas, its extruded edges not included, and the shelf of its cell
interface FrameRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly shelf: Shelf;
}

// the staging canvas upload() copies a changed cell into, and its texture, the source of the copy on the GPU
interface Staging {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly context: DynamicAtlasContext;
  readonly texture: CanvasTexture<HTMLCanvasElement | OffscreenCanvas>;
}

const WHERE = 'DynamicAtlas';

// where the copies of upload() would move half the atlas or more, one whole upload is cheaper: a single
// transfer, and no submit for each cell
const WHOLE_UPLOAD_SHARE = 0.5;

function assertFilter(filter: unknown): asserts filter is DynamicAtlasFilter {
  if (filter !== 'linear' && filter !== 'nearest') {
    throw new TypeError(`${WHERE}: the filter ${describeValue(filter)} is neither 'linear' nor 'nearest'`);
  }
}

const isWhole = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min;

const assertWhole = (value: unknown, min: number, what: string): number => {
  if (!isWhole(value, min)) {
    throw new RangeError(`${WHERE}: the ${what} must be a whole number of ${min} or more, got ${describeValue(value)}`);
  }
  return value;
};

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
 * straight alpha and without mipmaps. `add()`, `redraw()` and `remove()` mark it for upload — the
 * renderer uploads the whole canvas once with the next render that uses it — until {@link upload}
 * is called for the first time; from then on they leave it to the next `upload()`, which copies the
 * changed cells alone. `clear()` marks the whole canvas either way.
 *
 * {@link textureFor} answers a second texture of the same canvas with the other filter — smooth
 * portraits and pixel labels out of one atlas —, and every change reaches both.
 *
 * The atlas owns its textures, a canvas it built itself and the staging canvas and texture of
 * {@link upload}; {@link dispose} releases them. A canvas handed in stays the caller's.
 */
export class DynamicAtlas {
  /** The width of the area the frames are packed into, in texels: the option, or the width of the canvas handed in. */
  readonly width: number;
  /** The height of the area the frames are packed into, in texels: the option, or the height of the canvas handed in. */
  readonly height: number;
  /** The clear texels between two frames and between a frame and the edge: the option, 1 without it. */
  readonly padding: number;
  /** How many texels the edge of every frame is repeated outwards: the option, 0 without it. */
  readonly extrude: number;
  /** The filter of {@link texture}: the option, `'linear'` without it. */
  readonly filter: DynamicAtlasFilter;

  readonly #canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly #ownsCanvas: boolean;
  readonly #context: DynamicAtlasContext;
  readonly #texture: CanvasTexture<HTMLCanvasElement | OffscreenCanvas>;
  // the texture of the other filter, built by the first textureFor() that asks for it
  #otherTexture: CanvasTexture<HTMLCanvasElement | OffscreenCanvas> | undefined;
  // the canvas as a whole: the parent of the coords of every frame
  readonly #root: TextureCoords;

  #atlas = new TextureAtlas();
  // where each frame lies in the canvas, kept apart from its `data`: a caller may change that, and redraw()
  // and remove() still clear and draw the cell the frame was packed into
  #cells = new Map<TextureAtlasFrame, FrameRect>();
  #shelves: Shelf[] = [];
  #disposed = false;

  // set by the first upload(): from then on add(), redraw() and remove() leave the texture to the next upload()
  #regionUploads = false;
  // the cells changed since the last upload(), each once
  readonly #dirty: FrameRect[] = [];
  #staging: Staging | undefined;
  readonly #srcRegion = new Box2();
  readonly #dstPosition = new Vector2();

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
    assertFilter(filter);
    this.filter = filter;
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

    this.#texture = this.#buildTexture(filter);
  }

  // a texture of the canvas with `filter`, in every other setting the same for each filter
  #buildTexture(filter: DynamicAtlasFilter): CanvasTexture<HTMLCanvasElement | OffscreenCanvas> {
    const texture = new CanvasTexture(this.#canvas);
    texture.name = 'twopoint5d.DynamicAtlas';
    // the convention of every atlas of the library: v counts downwards, as TextureCoords do
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    // the canvas keeps its texels premultiplied; both backends hand them on unpremultiplied with this
    texture.premultiplyAlpha = false;
    // a change uploads the whole canvas or copies its changed cells, and the small mip levels of a packed atlas mix its frames
    texture.generateMipmaps = false;
    texture.magFilter = filter === 'nearest' ? NearestFilter : LinearFilter;
    texture.minFilter = filter === 'nearest' ? NearestFilter : LinearFilter;
    return texture;
  }

  // the textures of the canvas there are: the one of the atlas' filter, and the other one once it is asked for
  #markTextures(): void {
    this.#texture.needsUpdate = true;
    if (this.#otherTexture !== undefined) this.#otherTexture.needsUpdate = true;
  }

  /**
   * The frames of the atlas — an ordinary `TextureAtlas`, and a new one after {@link clear}. Still
   * answers after {@link dispose}.
   */
  get atlas(): TextureAtlas {
    return this.#atlas;
  }

  /**
   * The texture of the canvas, read with {@link filter}; built once and never replaced, and the atlas
   * owns it.
   *
   * @throws {Error} once the atlas is disposed.
   */
  get texture(): CanvasTexture<HTMLCanvasElement | OffscreenCanvas> {
    this.#assertAlive('texture');
    return this.#texture;
  }

  /**
   * The texture of the canvas read with `filter`: {@link texture} for the filter of the atlas, else a
   * second texture of the same canvas, built by the first call and answered by every call after it.
   * It differs from `texture` in its filters alone, and the atlas owns it as it owns `texture`.
   *
   * Every change reaches both textures — `add()`, `redraw()` and `remove()` mark both until the first
   * {@link upload}, which copies each changed cell into both from then on —, and each is a GPU
   * texture of its own: the second costs the memory of the canvas once more, and a whole upload goes
   * up twice.
   *
   * @throws {TypeError} for a filter that is neither `'linear'` nor `'nearest'`.
   * @throws {Error} once the atlas is disposed.
   */
  textureFor(filter: DynamicAtlasFilter): CanvasTexture<HTMLCanvasElement | OffscreenCanvas> {
    this.#assertAlive('textureFor()');
    assertFilter(filter);
    if (filter === this.filter) return this.#texture;
    this.#otherTexture ??= this.#buildTexture(filter);
    return this.#otherTexture;
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

  /** `true` from the first {@link dispose} on. */
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
   * size of an image element — or scaled to `size`; an image element that has loaded without a natural
   * size, an SVG without `width` and `height`, needs the `size`. A size is rounded up to whole texels.
   *
   * A frame that does not fit is refused, and a callback that throws leaves the atlas as it was: in
   * both cases no frame is added and no cell is taken.
   *
   * @throws {Error} for a name that is taken, an image element that is still loading — with or without a
   *   size —, an image element without a natural size and without a `size` — one that failed to load among
   *   them —, a closed ImageBitmap or a canvas of no size, a frame that does not fit (a `RangeError`), and
   *   once the atlas is disposed.
   * @throws {DOMException} an `InvalidStateError` from `drawImage()` for an image element that failed to
   *   load, given a `size` — without one it has no natural size and is refused as above; no frame is added
   *   and no cell is taken.
   * @throws {RangeError} for a size that is no finite number above 0.
   * @throws {TypeError} for a draw callback without a size.
   */
  add(name: TextureAtlasFrameName, draw: DynamicAtlasDraw, size: DynamicAtlasSize): TextureAtlasFrame;
  add(name: TextureAtlasFrameName, image: DynamicAtlasImage, size?: DynamicAtlasSize): TextureAtlasFrame;
  add(name: TextureAtlasFrameName, source: DynamicAtlasSource, size?: DynamicAtlasSize): TextureAtlasFrame {
    this.#assertAlive('add()');
    if (this.#atlas.frameId(name) !== undefined) {
      throw new Error(
        `${WHERE}: the frame name ${describeValue(name)} is already taken — redraw() draws it anew, remove() lets go of it`,
      );
    }
    const {width, height} = this.#sizeOf(name, source, size);

    const rollback = this.#pack(name, width, height);
    const rect: FrameRect = {
      x: rollback.x + this.extrude,
      y: rollback.y + this.extrude,
      w: width,
      h: height,
      shelf: rollback.shelf,
    };
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
    this.#changed(rect);
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
   * A draw callback or an image that throws leaves the frame as far as it got — its cell cleared, perhaps drawn in part — and
   * marked for upload as any change is — the whole texture until the first {@link upload}, its cell for the next `upload()` from
   * then on; the frame, its name and its cell stay, and the error goes on to the caller. An image element that is still loading,
   * a closed ImageBitmap and a canvas of no size are refused before anything is cleared. An image element that has loaded without
   * a natural size is drawn at the size of the frame; one that failed to load makes `drawImage()` throw and leaves the frame
   * cleared, like any image that throws.
   *
   * A frame redrawn every frame — a counter, a timer — wants {@link upload} before each render: it copies
   * the cell alone, where the whole canvas goes up otherwise, 16 MiB at 2048 × 2048.
   *
   * @throws {Error} for a name the atlas does not hold, an image element that is still loading, a closed
   *   ImageBitmap or a canvas of no size, and once the atlas is disposed.
   */
  redraw(name: TextureAtlasFrameName, source: DynamicAtlasSource): TextureAtlasFrame {
    this.#assertAlive('redraw()');
    const frame = this.#atlas.frame(name);
    const rect = frame === undefined ? undefined : this.#cells.get(frame);
    if (frame === undefined || rect === undefined) {
      throw new Error(`${WHERE}: there is no frame ${describeValue(name)} to redraw — add() it first`);
    }
    if (typeof source !== 'function') this.#assertDrawable(name, source, 'redraw()');
    try {
      this.#draw(rect, source);
    } finally {
      // the cell was cleared at the least, so the canvas changed whether the draw went through or not
      this.#changed(rect);
    }
    return frame;
  }

  /**
   * Clears the cell of the frame `name`, lets go of the name — {@link atlas} finds it no longer, and
   * `add()` may take it again — and gives the cell back: the next frame that fits is packed into it, a
   * narrower one into its left part. The frame keeps its id, and `atlas.get(id)` still answers it — its
   * coords show the cell, cleared until another frame is packed into it and that frame afterwards —, but
   * it leaves the random draws of the atlas — `randomFrame()` and its siblings — and a table of every
   * frame — `frameTable(atlas)`, `atlasFrameTable(atlas)` —, and the message of a full atlas counts only
   * the frames it holds. Answers `false` for a name the atlas does not hold, and once the atlas is
   * disposed.
   */
  remove(name: TextureAtlasFrameName): boolean {
    if (this.#disposed) return false;
    const frame = this.#atlas.frame(name);
    const rect = frame === undefined ? undefined : this.#cells.get(frame);
    if (frame === undefined || rect === undefined) return false;
    this.#clearCell(rect);
    this.#cells.delete(frame);
    this.#release(rect);
    this.#atlas[forgetFrameName](name);
    this.#changed(rect);
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
    this.#markTextures();
    this.#dirty.length = 0;
  }

  /**
   * Copies the cells changed since the last call into the texture as `renderer` holds it — into both
   * textures, with a second one of {@link textureFor} —, each from a staging texture through
   * `renderer.copyTextureToTexture()`; call it once per frame, before the render. The first call
   * copies nothing — every change before it has marked the whole texture — and from then on `add()`,
   * `redraw()` and `remove()` leave the texture to the next call, so a change shows only after it.
   * Where the copies would cover half the atlas or more, it marks the whole texture instead; `clear()`
   * marks it either way. A call that throws — while it builds its staging canvas or in a copy — marks
   * the whole texture, so no change is lost, and the error goes on to the caller. Whatever it marks,
   * it marks in both textures.
   *
   * The renderer is the one that draws the texture, initialised: another renderer gets the canvas
   * as it is with its first render and none of the copies after. Without this call every change
   * uploads the whole canvas with the next render — 16 MiB at 2048 × 2048. Does nothing once the atlas
   * is disposed.
   */
  upload(renderer: WebGPURenderer): void {
    if (this.#disposed) return;
    if (!this.#regionUploads) {
      this.#regionUploads = true;
      return;
    }
    const dirty = this.#dirty;
    if (dirty.length === 0) return;

    const e = this.extrude;
    let needW = 0;
    let needH = 0;
    for (const rect of dirty) {
      needW = Math.max(needW, rect.w + 2 * e);
      needH = Math.max(needH, rect.h + 2 * e);
    }
    const stageW = Math.max(needW, this.#staging?.canvas.width ?? 0);
    const stageH = Math.max(needH, this.#staging?.canvas.height ?? 0);
    if (dirty.length * stageW * stageH >= WHOLE_UPLOAD_SHARE * this.width * this.height) {
      this.#markTextures();
      dirty.length = 0;
      return;
    }

    try {
      const staging = this.#ensureStaging(stageW, stageH);
      const {context} = staging;
      // one staging canvas serves every cell: each backend runs the upload of the staging texture, the copy
      // out of it and the next upload in the order they are called — WebGPU submits each copy at once into
      // its queue, WebGL 2 issues them in one command stream
      for (const rect of dirty) {
        const cx = rect.x - e;
        const cy = rect.y - e;
        const cw = rect.w + 2 * e;
        const ch = rect.h + 2 * e;
        context.save();
        try {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalAlpha = 1;
          // the cell replaces what the canvas held, its clear texels as well
          context.globalCompositeOperation = 'copy';
          context.imageSmoothingEnabled = false;
          context.drawImage(this.#canvas, cx, cy, cw, ch, 0, 0, cw, ch);
        } finally {
          context.restore();
        }
        staging.texture.needsUpdate = true;
        this.#srcRegion.min.set(0, 0);
        this.#srcRegion.max.set(cw, ch);
        this.#dstPosition.set(cx, cy);
        renderer.copyTextureToTexture(staging.texture, this.#texture, this.#srcRegion, this.#dstPosition);
        if (this.#otherTexture !== undefined) {
          renderer.copyTextureToTexture(staging.texture, this.#otherTexture, this.#srcRegion, this.#dstPosition);
        }
      }
    } catch (error) {
      this.#markTextures();
      throw error;
    } finally {
      dirty.length = 0;
    }
  }

  /**
   * Disposes the textures — the second one of {@link textureFor} among them — and the staging texture
   * of {@link upload}, and shrinks a canvas the atlas built
   * itself and the staging canvas to 0 × 0; a canvas handed in is left alone. Afterwards `texture`,
   * `textureFor()`, `canvas` and `context` throw, and so do `add()` and `redraw()`; `remove()` answers `false`, and
   * `clear()` and `upload()` do nothing; `atlas` and the sizes answer what they held. A second call does
   * nothing.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#texture.dispose();
    this.#otherTexture?.dispose();
    if (this.#ownsCanvas) {
      this.#canvas.width = 0;
      this.#canvas.height = 0;
    }
    this.#dropStaging();
    this.#dirty.length = 0;
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
        `${WHERE}: add(${describeValue(name)}) with a draw callback needs the size — add(name, draw, {width, height})`,
      );
    }
    if (typeof source !== 'function') {
      // with a size as well: drawImage() draws nothing of an image that is still loading, and the frame
      // would stay empty for good
      this.#assertDrawable(name, source, 'add()');
      if (size == null) return this.#naturalSize(name, source);
    }
    const given = size as DynamicAtlasSize;
    const check = (value: unknown, what: string): number => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new RangeError(
          `${WHERE}: the ${what} of the frame ${describeValue(name)} must be a finite number above 0, got ${describeValue(value)}`,
        );
      }
      return Math.ceil(value);
    };
    return {width: check(given.width, 'width'), height: check(given.height, 'height')};
  }

  // Takes a cell for a frame of `width` × `height` — the leftmost freed cell it fits into on the lowest
  // shelf that has room, else the tail of that shelf, else a new shelf — and answers its top left corner,
  // its shelf and the way to give it back. Throws, changing nothing, for a frame that does not fit
  #pack(name: TextureAtlasFrameName, width: number, height: number): {x: number; y: number; shelf: Shelf; undo: () => void} {
    const {padding, extrude} = this;
    const cellWidth = width + 2 * extrude;
    const cellHeight = height + 2 * extrude;

    if (cellWidth + 2 * padding > this.width || cellHeight + 2 * padding > this.height) {
      throw new RangeError(
        `${WHERE}: the frame ${describeValue(name)} of ${width} × ${height} does not fit into an atlas of ${this.width} × ${this.height} with padding ${padding} and extrude ${extrude} — build a larger atlas`,
      );
    }

    const room = cellWidth + padding;
    // the lowest shelf the cell fits onto — into a freed cell or onto its tail —, the first of equal ones
    let best: Shelf | undefined;
    for (const shelf of this.#shelves) {
      if (shelf.height < cellHeight || (best !== undefined && shelf.height >= best.height)) continue;
      if (shelf.x + room <= this.width || shelf.free.some((span) => span.end - span.start >= room)) best = shelf;
    }
    if (best !== undefined) {
      const shelf = best;
      const index = shelf.free.findIndex((span) => span.end - span.start >= room);
      if (index >= 0) {
        const span = shelf.free[index]!;
        const x = span.start;
        span.start += room;
        if (span.start === span.end) shelf.free.splice(index, 1);
        return {
          x,
          y: shelf.y,
          shelf,
          undo: () => {
            span.start = x;
            if (!shelf.free.includes(span)) shelf.free.splice(index, 0, span);
          },
        };
      }
      const x = shelf.x;
      shelf.x += room;
      return {
        x,
        y: shelf.y,
        shelf,
        undo: () => {
          shelf.x = x;
        },
      };
    }

    const last = this.#shelves.at(-1);
    const y = last === undefined ? padding : last.y + last.height + padding;
    if (y + cellHeight + padding > this.height) {
      const count = this.#cells.size;
      throw new RangeError(
        `${WHERE}: the atlas of ${this.width} × ${this.height} is full — the frame ${describeValue(name)} of ${width} × ${height} does not fit beside ${count === 1 ? 'the 1 frame' : `the ${count} frames`} packed into it; build a larger one — new DynamicAtlas({width: ${2 * this.width}, height: ${2 * this.height}}) — or clear() it`,
      );
    }
    const shelf: Shelf = {y, height: cellHeight, x: padding + room, free: []};
    this.#shelves.push(shelf);
    return {
      x: padding,
      y,
      shelf,
      undo: () => {
        this.#shelves.pop();
      },
    };
  }

  // Gives the cell of `rect` back to its shelf: a free span, merged with the free spans it touches, fallen
  // back to the tail where it reaches it; an empty last shelf leaves the shelves, so that a taller frame
  // may open one in its place
  #release(rect: FrameRect): void {
    const {shelf} = rect;
    const e = this.extrude;
    const start = rect.x - e;
    const end = start + rect.w + 2 * e + this.padding;
    const free = shelf.free;

    let index = 0;
    while (index < free.length && free[index]!.start < start) index++;
    let span: FreeSpan = {start, end};
    const left = free[index - 1];
    if (left !== undefined && left.end === start) {
      left.end = end;
      span = left;
      index--;
    } else {
      free.splice(index, 0, span);
    }
    const right = free[index + 1];
    if (right !== undefined && span.end === right.start) {
      span.end = right.end;
      free.splice(index + 1, 1);
    }
    if (span.end === shelf.x) {
      shelf.x = span.start;
      free.splice(index, 1);
    }

    const shelves = this.#shelves;
    for (let last = shelves.at(-1); last !== undefined && last.x === this.padding && last.free.length === 0; ) {
      shelves.pop();
      last = shelves.at(-1);
    }
  }

  // Refuses an image that cannot be drawn now, before anything is packed or cleared: an image element
  // that is still loading — the browser knows its size once it is "partially available", before the
  // last of it has arrived, and drawImage() draws nothing of it — and an ImageBitmap or a canvas of no
  // size, a closed ImageBitmap among them, which drawImage() refuses. An image element that has
  // finished passes whatever its natural size: an SVG without width and height has none and is drawn
  // at the size it is given, and one that failed to load is refused by #naturalSize() without a size
  // and makes drawImage() throw with one
  #assertDrawable(name: TextureAtlasFrameName, image: DynamicAtlasImage, call: string): void {
    if ('naturalWidth' in image) {
      if ('complete' in image && image.complete === false) {
        throw new Error(`${WHERE}: the image of ${describeValue(name)} has not loaded yet — await image.decode() before ${call}`);
      }
      return;
    }
    if (!(image.width > 0) || !(image.height > 0)) {
      throw new Error(
        `${WHERE}: the image of ${describeValue(name)} is ${image.width} × ${image.height} — a closed ImageBitmap or a canvas of no size has nothing to draw`,
      );
    }
  }

  // the size an image is drawn at by itself, refused for an image element without a natural size
  #naturalSize(name: TextureAtlasFrameName, image: DynamicAtlasImage): {width: number; height: number} {
    const natural = sizeOfImage(image);
    if (!(natural.width > 0) || !(natural.height > 0)) {
      throw new Error(
        `${WHERE}: the image of ${describeValue(name)} has no natural size — an SVG without width and height needs the size: add(name, image, {width, height}); an image that failed to load cannot be drawn at all`,
      );
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

  // the textures without upload() so far, the next upload() afterwards
  #changed(rect: FrameRect): void {
    if (!this.#regionUploads) {
      this.#markTextures();
    } else if (!this.#dirty.includes(rect)) {
      this.#dirty.push(rect);
    }
  }

  // The staging canvas and texture, built anew where the ones there are smaller than `width` × `height`.
  // They carry the settings of the atlas texture, so both get the same GPU format and the copy stays texel
  // for texel
  #ensureStaging(width: number, height: number): Staging {
    const staging = this.#staging;
    if (staging !== undefined && staging.canvas.width >= width && staging.canvas.height >= height) return staging;
    this.#dropStaging();
    const canvas = buildCanvas(width, height);
    // the union of both canvas types has no getContext() that TypeScript can call with '2d'
    const context = expectDefined(
      (canvas as HTMLCanvasElement).getContext('2d') as DynamicAtlasContext | null,
      'the 2D context of a canvas of its own',
    );
    const texture = new CanvasTexture(canvas);
    texture.name = 'twopoint5d.DynamicAtlas.staging';
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.premultiplyAlpha = false;
    texture.generateMipmaps = false;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    this.#staging = {canvas, context, texture};
    return this.#staging;
  }

  #dropStaging(): void {
    const staging = this.#staging;
    if (staging === undefined) return;
    staging.texture.dispose();
    staging.canvas.width = 0;
    staging.canvas.height = 0;
    this.#staging = undefined;
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
