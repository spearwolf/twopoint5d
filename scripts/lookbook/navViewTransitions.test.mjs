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

// the components that make up the navbar of each page, and the names the design pairs between them
const PAGES = {
  explorer: {
    components: ['components/LookbookHeader.astro', 'components/SearchLookbook.astro'],
    names: ['lb-curtain', 'lb-dialog', 'lb-logo', 'lb-rainbow', 'lb-search', 'lb-wordmark'],
  },
  demo: {
    components: ['components/DemoNavBar.astro'],
    names: ['lb-caption-post', 'lb-caption-pre', 'lb-curtain', 'lb-demo-title', 'lb-dialog', 'lb-logo', 'lb-rainbow'],
  },
};

/**
 * Every `view-transition-name: lb-…` of a source, with the text of the rule's selector (which
 * may carry the comment in front of it)
 *
 * @param {string} source
 * @returns {{selector: string, name: string}[]}
 */
const declaredNames = (source) =>
  [...source.matchAll(/([^{}]+)\{[^{}]*?view-transition-name:\s*(lb-[a-z-]+)/g)].map((m) => ({
    selector: (m[1] ?? '').trim(),
    name: m[2] ?? '',
  }));

/** @param {{components: string[]}} page */
const namesOf = (page) => page.components.flatMap((file) => declaredNames(src(file)));

/** @param {string} source @param {string} tag */
const count = (source, tag) => source.split(tag).length - 1;

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

  for (const [page, spec] of Object.entries(PAGES)) {
    it(`the ${page} declares exactly the names of the design, each once`, () => {
      const declared = namesOf(spec)
        .map(({name}) => name)
        .sort();
      assert.deepEqual(declared, spec.names);
    });
  }

  it('renders each component that carries names once per page', () => {
    assert.equal(count(src('pages/index.astro'), '<LookbookHeader'), 1);
    assert.equal(count(src('components/LookbookHeader.astro'), '<SearchLookbook'), 1);
    assert.equal(count(src('layouts/VanillaDemo.astro'), '<DemoNavBar'), 1);
  });

  it('names a dialog only while it is open', () => {
    const dialogs = [...namesOf(PAGES.explorer), ...namesOf(PAGES.demo)].filter(({name}) => name === 'lb-dialog');
    assert.equal(dialogs.length, 2);
    for (const {selector} of dialogs) {
      assert.match(selector, /\[open\]$/, `lb-dialog is set on "${selector}", which matches a closed dialog too`);
    }
  });

  it('holds the first render of each layout until its navbar is parsed', () => {
    for (const [layout, component, id] of /** @type {[string, string, string][]} */ ([
      ['layouts/Layout.astro', 'components/LookbookHeader.astro', 'lb-explorer-nav'],
      ['layouts/VanillaDemo.astro', 'components/DemoNavBar.astro', 'lb-demo-nav'],
    ])) {
      assert.match(
        src(layout),
        new RegExp(`<link[^>]*rel="expect"[^>]*href="#${id}"[^>]*blocking`),
        `${layout} has no render-blocking <link rel="expect"> for #${id}`,
      );
      assert.match(src(component), new RegExp(`id="${id}"`), `${component} carries no element #${id}`);
    }
  });
});
