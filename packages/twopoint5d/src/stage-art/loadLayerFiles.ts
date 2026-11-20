import type {WebGPURenderer} from 'three/webgpu';

import {DynamicAtlas, type DynamicAtlasSize, packsInto} from '../texture/DynamicAtlas.js';
import {readMaxTextureSize} from '../texture/readMaxTextureSize.js';
import {resolveRelativeUrl} from '../texture/resolveRelativeUrl.js';
import {describeValue} from '../utils/describeValue.js';
import type {LayerBox} from './artLayout.js';
import {frameNameOfFile, type LayerFileResult, parseLayerFileName} from './artSources.js';
import {trimLayerImage} from './trimLayerImage.js';

/** The clear texels around each picture in the atlas of a files source (§5.1). */
export const FILES_ATLAS_PADDING = 2;
/** How far the edge of each picture is repeated outwards there, for linear filtering (§5.1). */
export const FILES_ATLAS_EXTRUDE = 1;
/** The largest size of that atlas while the limit of the renderer is not known. */
export const FILES_ATLAS_MAX_SIZE = 4096;

/**
 * The url of a file of a files source: the file under `baseUrl`, a `#` written `%23` — a numbered
 * frame `steam#3.png` is a file, not a fragment of `steam`.
 */
export const urlOfLayerFile = (file: string, baseUrl: string | undefined): string =>
  resolveRelativeUrl(file.replaceAll('#', '%23'), baseUrl);

/** What a load of the files of a files source made of them. */
export interface LayerFilesOutcome {
  /** The size of the first file that loaded; `undefined` where none did. */
  canvas: {width: number; height: number} | undefined;
  /** What became of each file, in the order of the list. */
  results: LayerFileResult[];
  /** The atlas the pictures are packed into, now the caller's; `undefined` where there is none to draw. */
  atlas?: DynamicAtlas;
  /** Why the pictures were not packed: they do not fit into the largest atlas allowed. */
  refusal?: string;
}

interface Decoded {
  bitmap: ImageBitmap;
  // its trimmed box, undefined for a file without a pixel
  box: LayerBox | undefined;
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : describeValue(error));

/**
 * One load of the files of a files source (§4.2): each file fetched — one request per file, side by
 * side —, decoded through `createImageBitmap()` and trimmed to its alpha box as it lands; once every
 * file has landed or failed, the pictures to draw are packed into a `DynamicAtlas` of the next power
 * of two that holds them (§5.1) and every bitmap is closed. {@link drop} gives the load up.
 */
export class LayerFilesLoad {
  readonly #abort = new AbortController();
  // the bitmaps decoded and not closed yet
  readonly #open = new Set<ImageBitmap>();
  #dropped = false;

  /**
   * Gives the load up: aborts the requests on their way, closes the bitmaps decoded so far, and one
   * that lands later the moment it lands; {@link run} then answers `undefined`.
   */
  drop(): void {
    if (this.#dropped) return;
    this.#dropped = true;
    this.#abort.abort();
    for (const bitmap of this.#open) bitmap.close();
    this.#open.clear();
  }

  /**
   * Loads `files` under `baseUrl` and packs them — the atlas up to the limit of the device of
   * `renderer`, 4096 while it is not known. Answers `undefined` once dropped. A file that fails is a
   * problem in its result; a set of pictures that does not fit into the largest atlas allowed is a
   * `refusal`, and nothing is packed.
   */
  async run(
    files: readonly string[],
    baseUrl: string | undefined,
    renderer: WebGPURenderer | undefined,
  ): Promise<LayerFilesOutcome | undefined> {
    const urls = files.map((file) => urlOfLayerFile(file, baseUrl));
    const decoded = await Promise.all(files.map((file, index) => this.#decode(file, urls[index]!)));
    if (this.#dropped) return undefined;
    try {
      return this.#pack(files, urls, decoded, renderer);
    } finally {
      for (const entry of decoded) if (typeof entry !== 'string') entry.bitmap.close();
      this.#open.clear();
    }
  }

  // the file fetched, decoded and trimmed, or the problem that kept it out
  async #decode(file: string, url: string): Promise<Decoded | string> {
    let blob: Blob;
    try {
      const response = await fetch(url, {signal: this.#abort.signal});
      if (!response.ok) return `the file ${describeValue(file)} did not load: the server answered ${response.status}`;
      blob = await response.blob();
    } catch (error) {
      return `the file ${describeValue(file)} did not load: ${messageOf(error)}`;
    }
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch (error) {
      return `the file ${describeValue(file)} could not be decoded as an image: ${messageOf(error)}`;
    }
    if (this.#dropped) {
      bitmap.close();
      return 'the load was dropped';
    }
    this.#open.add(bitmap);
    try {
      return {bitmap, box: trimLayerImage(bitmap)};
    } catch (error) {
      bitmap.close();
      this.#open.delete(bitmap);
      return `the pixels of the file ${describeValue(file)} could not be read: ${messageOf(error)}`;
    }
  }

  #pack(
    files: readonly string[],
    urls: readonly string[],
    decoded: readonly (Decoded | string)[],
    renderer: WebGPURenderer | undefined,
  ): LayerFilesOutcome {
    const results: LayerFileResult[] = [];
    let canvas: {width: number; height: number} | undefined;
    let canvasFile = '';
    // the pictures to draw: a file of a name taken before stays out, as the reader takes the first
    const toPack: {index: number; name: string; bitmap: ImageBitmap; box: LayerBox}[] = [];
    const names = new Set<string>();
    decoded.forEach((entry, index) => {
      const url = urls[index]!;
      const file = files[index]!;
      if (typeof entry === 'string') {
        results.push({url, problem: entry});
        return;
      }
      const {bitmap, box} = entry;
      if (canvas === undefined) {
        canvas = {width: bitmap.width, height: bitmap.height};
        canvasFile = file;
      } else if (bitmap.width !== canvas.width || bitmap.height !== canvas.height) {
        results.push({
          url,
          problem: `the file ${describeValue(file)} is ${bitmap.width} × ${bitmap.height}, and the canvas — the size of ${describeValue(canvasFile)}, the first file that loaded — is ${canvas.width} × ${canvas.height}`,
        });
        return;
      }
      // the frame of a picture to draw follows once it is packed
      results.push(box === undefined ? {url, box: undefined} : {url, box});
      const name = frameNameOfFile(file);
      if (box === undefined || parseLayerFileName(name).pivotOf !== undefined || names.has(name)) return;
      names.add(name);
      toPack.push({index, name, bitmap, box});
    });
    if (toPack.length === 0) return {canvas, results};

    const sizes: DynamicAtlasSize[] = toPack.map(({box}) => ({width: box.w, height: box.h}));
    const limit = renderer === undefined ? undefined : readMaxTextureSize(renderer);
    const max = limit ?? FILES_ATLAS_MAX_SIZE;
    let size = 0;
    let largest = 1;
    for (let edge = 1; edge <= max; edge *= 2) {
      largest = edge;
      if (packsInto(edge, edge, FILES_ATLAS_PADDING, FILES_ATLAS_EXTRUDE, sizes)) {
        size = edge;
        break;
      }
    }
    if (size === 0) {
      const count = `${toPack.length} file${toPack.length === 1 ? '' : 's'}`;
      const which =
        limit !== undefined
          ? 'the largest the renderer allows — '
          : renderer !== undefined
            ? 'the largest before the device of the renderer is known — await renderer.init() before the art loads for the limit of its device, or '
            : 'the largest before a renderer is known — hand the art its renderer (options.renderer) for the limit of its device, or ';
      return {
        canvas,
        results,
        refusal: `the trimmed pictures of the ${count} to draw do not fit into an atlas of ${largest} × ${largest} with padding ${FILES_ATLAS_PADDING} and extrude ${FILES_ATLAS_EXTRUDE}, ${which}split the files between two arts, each with a renderOrder of its own`,
      };
    }

    const atlas = new DynamicAtlas({width: size, height: size, padding: FILES_ATLAS_PADDING, extrude: FILES_ATLAS_EXTRUDE});
    try {
      for (const {index, name, bitmap, box} of toPack) {
        const frame = atlas.add(
          name,
          (context) => {
            context.drawImage(bitmap, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
          },
          {width: box.w, height: box.h},
        );
        results[index] = {url: urls[index]!, box, frame};
      }
    } catch (error) {
      atlas.dispose();
      throw error;
    }
    return {canvas, results, atlas};
  }
}
