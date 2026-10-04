import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  DEFAULT_TIMEOUT_MS,
  EVENT_GENERATE_PREVIEW,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  parsePreviewArgs,
  selectDemos,
} from './demoPreviewConfig.mjs';
import {listDemoPages, listLookbookDemos} from './lookbookDemos.mjs';

const lookbookFile = (rel) => fileURLToPath(new URL(`../../apps/lookbook/src/${rel}`, import.meta.url));

describe('the configuration of the preview generator', () => {
  it('listens for the event the lookbook dispatches', () => {
    const source = fs.readFileSync(lookbookFile('components/constants.ts'), 'utf8');
    const match = source.match(/EVENT_GENERATE_PREVIEW = '([^']+)'/);
    assert.equal(match?.[1], EVENT_GENERATE_PREVIEW);
  });

  it('takes screenshots in the aspect ratio of the card', () => {
    const card = fs.readFileSync(lookbookFile('components/Card.astro'), 'utf8');
    const ratios = [...card.matchAll(/aspect-(\d+)\/(\d+)/g)].map(([, w, h]) => [Number(w), Number(h)]);
    assert.equal(ratios.length, 1, 'Card.astro sets one aspect-<w>/<h> on its image');
    const [w = 0, h = 0] = ratios[0] ?? [];
    assert.equal(PREVIEW_WIDTH * h, PREVIEW_HEIGHT * w, `${PREVIEW_WIDTH}×${PREVIEW_HEIGHT} is not ${w}:${h}`);
  });
});

describe('parsePreviewArgs()', () => {
  it('has defaults for a run without flags', () => {
    assert.deepEqual(parsePreviewArgs([]), {only: undefined, url: undefined, headed: false, timeoutMs: DEFAULT_TIMEOUT_MS});
  });

  it('reads --only as a comma separated list, --url without its trailing slash, --headed and --timeout', () => {
    assert.deepEqual(
      parsePreviewArgs(['--only=crosses, first-sprite,', '--url=http://localhost:4321/lookbook/', '--headed', '--timeout=1000']),
      {only: ['crosses', 'first-sprite'], url: 'http://localhost:4321/lookbook', headed: true, timeoutMs: 1000},
    );
  });

  it('refuses an unknown flag', () => {
    assert.throws(() => parsePreviewArgs(['--onyl=crosses']), /onyl/);
  });

  it('refuses a timeout that is no positive whole number of milliseconds', () => {
    for (const value of ['0', '-5', '1.5', 'soon']) {
      assert.throws(() => parsePreviewArgs([`--timeout=${value}`]), /--timeout/);
    }
  });
});

describe('selectDemos()', () => {
  const ids = ['animated-sprites', 'crosses', 'first-sprite'];

  it('takes every demo without --only', () => {
    assert.deepEqual(selectDemos(ids, undefined), ids);
  });

  it('keeps the order of the demos, not of --only', () => {
    assert.deepEqual(selectDemos(ids, ['first-sprite', 'animated-sprites']), ['animated-sprites', 'first-sprite']);
  });

  it('names the unknown and the known ids for a typo', () => {
    assert.throws(
      () => selectDemos(ids, ['crosess']),
      /unknown demo id\(s\): crosess — known: animated-sprites, crosses, first-sprite/,
    );
  });
});

describe('listLookbookDemos()', () => {
  it('lists one demo per metadata file, sorted by id, paired with its page', () => {
    const demos = listLookbookDemos();
    const ids = demos.map(({id}) => id);
    assert.deepEqual(ids, [...ids].sort());
    assert.deepEqual(ids, [...listDemoPages()].sort());
    assert.ok(ids.includes('first-sprite'));
  });
});
