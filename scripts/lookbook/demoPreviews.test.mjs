import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {describe, it} from 'node:test';
import {PREVIEW_HEIGHT, PREVIEW_WIDTH} from './demoPreviewConfig.mjs';
import {listLookbookDemos, previewDir} from './lookbookDemos.mjs';
import {webpSize} from './webpSize.mjs';

// `pnpm lookbook:generate-previews` writes one image per demo, and the card of the demo
// derives its path from the id. This spec holds the directory to the demos: an image for
// each, nothing else, each in the size the card shows.
const demos = listLookbookDemos();
const files = fs.readdirSync(previewDir);
const expected = new Set(demos.map(({id}) => `${id}.webp`));

describe('the preview images of the lookbook demos', () => {
  it('has a <id>.webp for every demo', () => {
    const missing = [...expected].filter((file) => !files.includes(file));
    assert.deepEqual(missing, [], 'run `pnpm lookbook:generate-previews --only=<id>` for these demos');
  });

  it('holds nothing but the images of the demos', () => {
    const extra = files.filter((file) => !expected.has(file));
    assert.deepEqual(extra, [], 'these files belong to no demo; delete them');
  });

  it(`keeps every image at ${PREVIEW_WIDTH}×${PREVIEW_HEIGHT}, the aspect ratio of the card`, () => {
    const offenders = files
      .filter((file) => expected.has(file))
      .map((file) => ({file, ...webpSize(fs.readFileSync(path.join(previewDir, file)))}))
      .filter(({width, height}) => width !== PREVIEW_WIDTH || height !== PREVIEW_HEIGHT)
      .map(({file, width, height}) => `${file}: ${width}×${height}`);
    assert.deepEqual(offenders, []);
  });

  it('lets no metadata file name an image, the card derives it from the id', () => {
    const offenders = demos.filter(({json}) => 'previewImage' in json).map(({file}) => file);
    assert.deepEqual(offenders, []);
  });
});
