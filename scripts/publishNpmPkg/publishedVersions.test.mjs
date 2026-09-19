import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {isNotPublishedError, parsePublishedVersions} from './publishedVersions.mjs';

describe('parsePublishedVersions', () => {
  it('a single published version comes back as a list', () => {
    assert.deepEqual(parsePublishedVersions('"0.21.2"\n'), ['0.21.2']);
  });

  it('a list of published versions stays a list', () => {
    assert.deepEqual(parsePublishedVersions('[\n  "0.1.0",\n  "0.21.2"\n]\n'), ['0.1.0', '0.21.2']);
  });

  it('a version that only starts the single published one is not published', () => {
    assert.equal(parsePublishedVersions('"0.21.2"\n').includes('0.21'), false);
  });
});

describe('isNotPublishedError', () => {
  it('recognizes the not-found error of current npm', () => {
    assert.equal(
      isNotPublishedError(
        'npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@spearwolf%2fnot-published - Not found\n',
      ),
      true,
    );
  });

  it('recognizes the not-found error of older npm', () => {
    assert.equal(
      isNotPublishedError(
        'npm ERR! code E404\nnpm ERR! 404 Not Found - GET https://registry.npmjs.org/@spearwolf%2fnot-published - Not found\n',
      ),
      true,
    );
  });

  it('takes no other failure for a first publish', () => {
    for (const stderr of ['npm error code E401\n', 'npm error code ETIMEDOUT\n', '', undefined]) {
      assert.equal(isNotPublishedError(stderr), false);
    }
  });
});
