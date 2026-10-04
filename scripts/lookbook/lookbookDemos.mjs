// The demos of the lookbook as the scripts see them: one page `pages/demos/<id>.astro` and
// one metadata file `pages/demos/_<id>.json` per demo, and one preview image
// `public/images/demo-preview/<id>.webp`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const demosDir = fileURLToPath(new URL('../../apps/lookbook/src/pages/demos/', import.meta.url));
export const previewDir = fileURLToPath(new URL('../../apps/lookbook/public/images/demo-preview/', import.meta.url));

/** @returns {{id: string, file: string, json: any}[]} sorted by id */
export function listLookbookDemos() {
  return (
    fs
      .readdirSync(demosDir)
      .filter((file) => /^_.*\.json$/.test(file))
      .map((file) => ({
        id: file.slice(1, -'.json'.length),
        file,
        json: JSON.parse(fs.readFileSync(path.join(demosDir, file), 'utf8')),
      }))
      // by id, not by file name: `.json` sorts textured-quads after textured-quads-from-tileset
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  );
}

/** @returns {string[]} the names of the demo pages, without `.astro` */
export function listDemoPages() {
  return fs
    .readdirSync(demosDir)
    .filter((file) => file.endsWith('.astro'))
    .map((file) => file.slice(0, -'.astro'.length));
}
