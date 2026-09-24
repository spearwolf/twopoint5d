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
