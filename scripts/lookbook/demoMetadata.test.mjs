import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

// Every tag of a lookbook demo that starts with a capital letter advertises a class, a function or
// a type of the library, and a reader will search for that name. This spec holds those tags to the
// exports of `packages/twopoint5d/src/index.ts`. No other check reads the JSON files of the
// lookbook, so it also keeps each demo page paired with its metadata file and its route.
const demosUrl = new URL('../../apps/lookbook/src/pages/demos/', import.meta.url);
const demosDir = fileURLToPath(demosUrl);
const tagCategoriesFile = fileURLToPath(new URL('../../apps/lookbook/src/data/tag-categories.json', import.meta.url));
const entry = fileURLToPath(new URL('../../packages/twopoint5d/src/index.ts', import.meta.url));

// the sources are read and not `dist`, so the spec runs without a build, and type exports such as
// `VO` count as well
const program = ts.createProgram([entry], {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  skipLibCheck: true,
  strict: true,
});
const checker = program.getTypeChecker();
const exported = new Set(
  checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(entry))).map((sym) => sym.getName()),
);

const FROM_THREE = new Map([
  [
    'RenderPipeline',
    'the three.js class the post-processing demos build their pipeline from; the library extends it as RootRenderPipeline',
  ],
]);

const isNamed = (tag) => exported.has(tag) || FROM_THREE.has(tag);
const isCapitalised = (tag) => /^[A-Z]/.test(tag);

const files = fs.readdirSync(demosDir);
const pages = files.filter((file) => file.endsWith('.astro')).map((file) => file.slice(0, -'.astro'.length));
const metadata = files
  .filter((file) => /^_.*\.json$/.test(file))
  .map((file) => ({file, json: JSON.parse(fs.readFileSync(new URL(file, demosUrl), 'utf8'))}));

describe('the metadata of the lookbook demos', () => {
  it('pairs every demo page with a JSON file whose url is the route of the page', () => {
    const offenders = [];
    const jsonNames = new Set(metadata.map(({file}) => file));

    for (const page of pages) {
      if (!jsonNames.has(`_${page}.json`)) offenders.push(`${page}.astro: no _${page}.json`);
    }
    for (const {file, json} of metadata) {
      const page = file.slice(1, -'.json'.length);
      if (!pages.includes(page)) offenders.push(`${file}: no ${page}.astro`);
      if (json.url !== `/demos/${page}`) offenders.push(`${file}: url ${json.url} is not /demos/${page}`);
    }

    assert.deepEqual(offenders, [], 'every demo page has a JSON file of its own, and its url is the route of the page');
  });

  it('names an export of the library, or a three.js class listed here, with every tag that starts with a capital letter', () => {
    const offenders = [];

    for (const {file, json} of metadata) {
      for (const tag of json.tags ?? []) {
        if (isCapitalised(tag) && !isNamed(tag)) offenders.push(`${file}: ${tag}`);
      }
    }

    assert.deepEqual(offenders, [], 'a capitalised tag names an export of the library or a class of FROM_THREE');
  });

  it('lists every tag of tag-categories.json once, and names an export with every capitalised one', () => {
    const offenders = [];
    const seen = new Set();
    const {categories} = JSON.parse(fs.readFileSync(tagCategoriesFile, 'utf8'));

    for (const category of categories) {
      for (const tag of category.includeTags) {
        if (seen.has(tag)) offenders.push(`${category.name}: ${tag} is listed twice`);
        seen.add(tag);
        if (isCapitalised(tag) && !isNamed(tag)) offenders.push(`${category.name}: ${tag}`);
      }
    }

    assert.deepEqual(offenders, [], 'every tag is listed in one category once, and a capitalised one names an export');
  });
});
