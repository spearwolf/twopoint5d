/** @import {Display, VertexObjectDescription} from '@spearwolf/twopoint5d' */
import {
  Map2D,
  Map2DTileRenderer,
  RepeatingTilesProvider,
  TextureCoords,
  TileSet,
  TileSprites,
  TileSpritesFactory,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d';
import {DataTexture} from 'three/webgpu';

// The fixtures the browser tests build their cases from. A helper that a second test file
// needs moves here instead of being copied.

// --- containers and displays ---

/**
 * A box of exactly `width` × `height` CSS pixels at the top left of the page, appended to
 * `document.body`. The display measures its container, so nothing — padding, margin, border —
 * may add to that size. `id` names the box for a `resize-to` selector; without one it gets a
 * random id.
 *
 * @param {{width?: number, height?: number, id?: string}} [options]
 */
export function makeContainer({width = 320, height = 200, id} = {}) {
  const el = document.createElement('div');
  el.id = id ?? `fixture-${Math.random().toString(36).slice(2, 8)}`;
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.boxSizing = 'border-box';
  el.style.padding = '0';
  el.style.margin = '0';
  el.style.border = '0';
  document.body.appendChild(el);
  return el;
}

/**
 * Teardown must not mask the failure that got it here: no display, or a display that fails to
 * go down. It calls `dispose()` and nothing else — a disposed display refuses `start()`, and a
 * start in the teardown would cost a renderer init per test.
 *
 * @param {Display | undefined} display
 */
export function disposeDisplay(display) {
  if (!display) return;
  try {
    display.dispose();
  } catch {
    // ignore — the fixture still has to leave the dom
  }
}

/**
 * Resolves once renderer.dispose() has run — the release of a display happens after its dispose() has returned.
 *
 * @param {{dispose(): void}} renderer
 */
export function whenReleased(renderer) {
  return new Promise((resolve) => {
    const realDispose = renderer.dispose.bind(renderer);
    renderer.dispose = () => {
      realDispose();
      resolve();
    };
  });
}

/**
 * Settles with `'frames'` once the page has drawn two animation frames, or with `'no frame'`
 * when they have not come within a second — a page whose requestAnimationFrame has stopped.
 *
 * @returns {Promise<'frames' | 'no frame'>}
 */
export function whenPageAnimates() {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('no frame'), 1000);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve('frames');
      });
    });
  });
}

// --- input for PanControl2D ---

/**
 * PanControl2D listens on `document`, so a pointer event dispatched on any element bubbles up
 * to it. The element it is dispatched on — `document.body` unless `target` names another — is
 * what the control sees as `event.target`.
 */
export function pointer(type, {x = 0, y = 0, buttons = 1, pointerId = 1, pointerType = 'mouse', target = document.body} = {}) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId,
      isPrimary: true,
      pointerType,
      buttons,
      clientX: x,
      clientY: y,
    }),
  );
}

/** A key event on `document`, where PanControl2D listens; `init` names the key, usually by `code`. */
export function key(type, init) {
  document.dispatchEvent(new KeyboardEvent(type, {bubbles: true, ...init}));
}

/** The pan state a PanControl2D writes into: at the origin, at a pixel ratio of 1. */
export function makeState() {
  return {x: 0, y: 0, pixelRatio: 1};
}

// --- vertex objects ---

/**
 * The buffer behind an attribute — an interleaved attribute shares it with its siblings. It
 * carries the version that counts the uploads and the update ranges that steer them.
 */
export function bufferOf(attr) {
  return attr.isInterleavedBufferAttribute ? attr.data : attr;
}

/** Reads an attribute back out of the gpu buffer three has uploaded it into. */
export async function readBack(renderer, attr) {
  return Array.from(new Float32Array(await renderer.getArrayBufferAsync(attr)));
}

/** @type {VertexObjectDescription} */
export const quadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

/** @type {VertexObjectDescription} */
export const instancedDescription = {
  attributes: {instanceOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

// --- map2d ---

/** A map on the XZ ground plane, seen through `visibilitor`, without a loaded texture: the tile set builds its own atlas. */
export function makeMap(visibilitor) {
  const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
  const tileData = new RepeatingTilesProvider([
    [1, 2],
    [3, 4],
  ]);
  const tileSprites = new TileSprites(new TileSpritesGeometry(512), new TileSpritesMaterial());
  const tileRenderer = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData));

  const map2d = new Map2D();
  map2d.tileWidth = 256;
  map2d.tileHeight = 256;
  map2d.xOffset = -128;
  map2d.yOffset = -128;
  map2d.visibilitor = visibilitor;
  map2d.addTileRenderer(tileRenderer);

  return {map2d, tileSprites, tileRenderer};
}

// --- sprites and pixels ---

/**
 * A texture of the given texels, row by row from the first, each an `[r, g, b, a]` of 0 … 255.
 * A `DataTexture` samples with `NearestFilter` and builds no mipmaps, so a texel comes out of the
 * shader as it went in.
 *
 * @param {number[][]} texels
 * @param {number} [width]
 * @param {number} [height]
 */
export function makeColorTexture(texels, width = texels.length, height = 1) {
  const texture = new DataTexture(new Uint8Array(texels.flat()), width, height);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Renders `scene` through `camera` into `target` on an opaque black background and reads the
 * target back: four bytes per pixel, red, green, blue, alpha.
 */
export async function renderToPixels(renderer, scene, camera, target) {
  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(target);
  try {
    renderer.render(scene, camera);
  } finally {
    renderer.setRenderTarget(null);
  }
  return renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
}

/**
 * The `[r, g, b]` of the pixel at `x`, `y` of a read-back target `size` pixels wide.
 *
 * The pixels are read at a row length of `size * 4` bytes. WebGPU aligns every row it copies
 * out of a texture to 256 bytes, so that holds for a target 64 pixels wide, or a multiple of
 * it, and nothing else: at another width the rows come back padded and this reads the wrong
 * pixel without a word. Keep the targets of these tests at 64.
 */
export function rgbAt(pixels, size, x, y) {
  const i = (y * size + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2]];
}

/** Whether every channel of `rgb` lies within `tolerance` of the one in `expected`. */
export function isNearColor(rgb, expected, tolerance = 2) {
  return rgb.every((value, i) => Math.abs(value - expected[i]) <= tolerance);
}

/**
 * The width and height, in pixels, of the box around every pixel the sprite covered.
 *
 * It reads the pixels at a row length of `size * 4` bytes and needs a target 64 pixels wide,
 * or a multiple of it — see {@link rgbAt}.
 */
export function coveredBox(pixels, size) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // the clear color is black, and every sprite these tests measure draws brighter than that
      if (pixels[(y * size + x) * 4] > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX) return {width: 0, height: 0};
  return {width: maxX - minX + 1, height: maxY - minY + 1};
}
