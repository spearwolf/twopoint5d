// Where a generator writes: one directory per demo under `public/assets/`, emptied before the
// generator runs, so a renamed or dropped file does not linger.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {encodePng} from './png.mjs';

/** @typedef {import('./image.mjs').Img} Img */

export const ASSETS_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(ASSETS_SRC, '../../..');
export const PUBLIC_ASSETS = path.resolve(ASSETS_SRC, '../public/assets');

export class Output {
  /** @param {string} demo */
  constructor(demo) {
    this.demo = demo;
    this.dir = path.join(PUBLIC_ASSETS, demo);
    /** @type {string[]} */
    this.files = [];
  }

  /** Removes and recreates the output directory. */
  reset() {
    fs.rmSync(this.dir, {recursive: true, force: true});
    fs.mkdirSync(this.dir, {recursive: true});
  }

  /** @param {string} name */
  path(name) {
    const file = path.join(this.dir, name);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    this.files.push(file);
    return file;
  }

  /**
   * @param {string} name
   * @param {Img} img
   */
  png(name, img) {
    img.clearTransparent();
    fs.writeFileSync(this.path(name), encodePng(img.width, img.height, img.data));
  }

  /**
   * Written as JSON.stringify with two spaces; the build formats every JSON output with Biome
   * afterwards, the formatter the repo's lint holds them to.
   * @param {string} name
   * @param {unknown} data
   */
  json(name, data) {
    fs.writeFileSync(this.path(name), `${JSON.stringify(data, null, 2)}\n`);
  }

  /**
   * @param {string} name
   * @param {string} text
   */
  text(name, text) {
    fs.writeFileSync(this.path(name), text);
  }

  /**
   * @param {string} name
   * @param {Buffer} bytes
   */
  bytes(name, bytes) {
    fs.writeFileSync(this.path(name), bytes);
  }

  /**
   * @param {string} name
   * @param {string} source absolute path
   */
  copy(name, source) {
    fs.copyFileSync(source, this.path(name));
  }
}

/**
 * Throws with the generator's name when a check fails — a generator verifies its own output.
 * @param {unknown} condition
 * @param {string} message
 * @returns {asserts condition}
 */
export function check(condition, message) {
  if (!condition) throw new Error(`check failed: ${message}`);
}
