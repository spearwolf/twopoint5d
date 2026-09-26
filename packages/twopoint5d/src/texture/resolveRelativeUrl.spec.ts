import {afterEach, describe, expect, test, vi} from 'vitest';
import {resolveRelativeUrl} from './resolveRelativeUrl.js';

describe('resolveRelativeUrl resolves a url out of a json file against that file', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const catalogUrl = 'http://example.test/assets/catalog.json';

  test.each([
    ['a.png', 'http://example.test/assets/a.png'],
    ['../img/b.png', 'http://example.test/img/b.png'],
    ['/root.png', 'http://example.test/root.png'],
    ['//cdn.example.test/c.png', 'http://cdn.example.test/c.png'],
  ])('a relative url %j against an absolute base', (url, resolved) => {
    expect(resolveRelativeUrl(url, catalogUrl)).toBe(resolved);
    expect(resolveRelativeUrl(url, new URL(catalogUrl))).toBe(resolved);
  });

  test.each(['HTTP://Example.test/A%20b.png', 'data:image/png;base64,AAAA'])(
    'an absolute url %j comes back exactly as written',
    (url) => {
      expect(resolveRelativeUrl(url, catalogUrl)).toBe(url);
    },
  );

  test('an empty url stays empty', () => {
    expect(resolveRelativeUrl('', catalogUrl)).toBe('');
  });

  test('without a base the url stays as written', () => {
    expect(resolveRelativeUrl('a.png', undefined)).toBe('a.png');
  });

  test('a relative base is resolved against document.baseURI', () => {
    vi.stubGlobal('document', {baseURI: 'http://example.test/demo/page.html'});

    expect(resolveRelativeUrl('a.png', 'assets/catalog.json')).toBe('http://example.test/demo/assets/a.png');
  });

  test('in a worker a relative base is resolved against its location', () => {
    vi.stubGlobal('location', {href: 'http://example.test/workers/worker.js'});

    expect(resolveRelativeUrl('a.png', 'assets/catalog.json')).toBe('http://example.test/workers/assets/a.png');
  });

  test('without a document a relative base leaves the url as written', () => {
    expect(resolveRelativeUrl('a.png', 'assets/catalog.json')).toBe('a.png');
  });

  test('a blob: base leaves the url as written', () => {
    expect(resolveRelativeUrl('a.png', 'blob:http://example.test/0b1c2d3e')).toBe('a.png');
  });
});
