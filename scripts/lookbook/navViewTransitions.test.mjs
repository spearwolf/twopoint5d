import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

// The navbar of the lookbook morphs between the explorer and a demo through cross-document
// view transitions (apps/lookbook/README.md, "Navbar view transitions"). The browser pairs the
// elements of the two pages by their view-transition-name and skips the whole transition when a
// name occurs twice in one page; neither the build nor `astro check` sees any of it. This spec
// holds the names of each page to the pairs of the design, and the stylesheets to the names the
// pages declare.

/** @param {string} file a path below `apps/lookbook/src/` */
const src = (file) => fs.readFileSync(fileURLToPath(new URL(`../../apps/lookbook/src/${file}`, import.meta.url)), 'utf8');

/** @param {string} source @returns {string[]} the specifiers of the side-effect imports */
const importsOf = (source) => [...source.matchAll(/^import\s+'([^']+)';/gm)].map((m) => m[1] ?? '');

describe('the navbar view transitions', () => {
  it('both layouts opt in through the shared stylesheet', () => {
    for (const layout of ['layouts/Layout.astro', 'layouts/VanillaDemo.astro']) {
      assert.ok(
        importsOf(src(layout)).includes('../styles/view-transitions.css'),
        `${layout} does not import ../styles/view-transitions.css`,
      );
    }
  });

  it('opts every same-origin navigation in, and opts out under reduced motion', () => {
    const css = src('styles/view-transitions.css');
    assert.match(css, /@view-transition\s*\{\s*navigation:\s*auto;?\s*\}/);
    assert.match(
      css,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*@view-transition\s*\{\s*navigation:\s*none;?\s*\}\s*\}/,
    );
  });
});
