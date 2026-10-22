import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  DEFAULT_TIMEOUT_MS,
  EVENT_GENERATE_PREVIEW,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  parsePreviewArgs,
  recordPreviewEvent,
  refuseScreenshot,
  selectDemos,
  summarizeRun,
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
    assert.deepEqual(parsePreviewArgs([]), {
      only: undefined,
      url: undefined,
      headed: false,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      strict: false,
    });
  });

  it('reads --only as a comma separated list, --url without its trailing slash, --headed, --timeout and --strict', () => {
    assert.deepEqual(
      parsePreviewArgs([
        '--only=crosses, first-sprite,',
        '--url=http://localhost:4321/lookbook/',
        '--headed',
        '--timeout=1000',
        '--strict',
      ]),
      {
        only: ['crosses', 'first-sprite'],
        url: 'http://localhost:4321/lookbook',
        headed: true,
        timeoutMs: 1000,
        strict: true,
      },
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

  it('names the metadata file it cannot parse', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lookbook-demos-'));
    try {
      fs.writeFileSync(path.join(tmp, '_broken.json'), '{"url": }');
      assert.throws(
        () => listLookbookDemos(tmp),
        (error) => error instanceof Error && error.message.startsWith(`${path.join(tmp, '_broken.json')}: `),
      );
    } finally {
      fs.rmSync(tmp, {recursive: true, force: true});
    }
  });
});

describe('recordPreviewEvent()', () => {
  const g = /** @type {any} */ (globalThis);

  /** @param {(document: EventTarget) => void} body */
  const withPage = (body) => {
    g.document = new EventTarget();
    g.window = {};
    try {
      recordPreviewEvent('test.preview');
      body(g.document);
      return g.window.__lookbookPreview;
    } finally {
      delete g.document;
      delete g.window;
    }
  };

  it('records an event without a detail as a truthy value', () => {
    const recorded = withPage((document) => document.dispatchEvent(new CustomEvent('test.preview')));
    assert.deepEqual(recorded, {detail: null});
  });

  it('keeps the detail of the first event and ignores later ones', () => {
    const recorded = withPage((document) => {
      document.dispatchEvent(new CustomEvent('test.preview', {detail: {demoId: 'a', trigger: 'ready'}}));
      document.dispatchEvent(new CustomEvent('test.preview', {detail: {demoId: 'b', trigger: 'timeout'}}));
    });
    assert.deepEqual(recorded, {detail: {demoId: 'a', trigger: 'ready'}});
  });
});

describe('refuseScreenshot()', () => {
  it('refuses a page that threw, strict or not', () => {
    assert.equal(refuseScreenshot({pageErrors: 1, consoleErrors: 0}, false), 'the page threw 1 error(s)');
    assert.equal(refuseScreenshot({pageErrors: 1, consoleErrors: 0}, true), 'the page threw 1 error(s)');
  });

  it('lets console errors pass without --strict and refuses them with it', () => {
    assert.equal(refuseScreenshot({pageErrors: 0, consoleErrors: 2}, false), undefined);
    assert.equal(refuseScreenshot({pageErrors: 0, consoleErrors: 2}, true), 'the page logged 2 console error(s) under --strict');
  });

  it('accepts a page that reported nothing', () => {
    assert.equal(refuseScreenshot({pageErrors: 0, consoleErrors: 0}, true), undefined);
  });
});

describe('summarizeRun()', () => {
  const ok = (id, problems = []) => ({id, ok: true, seconds: 1, problems});

  it('counts the previews written and exits with 0 when every demo passed', () => {
    assert.deepEqual(summarizeRun([ok('a'), ok('b')]), {summary: '2 preview(s) written', exitCode: 0});
  });

  it('names the failed demos and exits with 1', () => {
    const {summary, exitCode} = summarizeRun([ok('a'), {id: 'b', ok: false, seconds: 1, problems: ['boom']}]);
    assert.equal(exitCode, 1);
    assert.match(summary, /1 of 2 failed/);
    assert.match(summary, /their old images stay/);
    assert.match(summary, /\bb\b/);
  });

  it('names the demos written with console errors on a second line and still exits with 0', () => {
    const {summary, exitCode} = summarizeRun([ok('a'), ok('b', ['console error: x'])]);
    assert.equal(exitCode, 0);
    const [, second] = summary.split('\n');
    assert.match(second ?? '', /1 written with console errors/);
    assert.match(second ?? '', /\bb\b/);
  });
});
