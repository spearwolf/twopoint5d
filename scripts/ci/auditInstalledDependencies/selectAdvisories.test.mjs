import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {importerId, selectAdvisories} from './selectAdvisories.mjs';

const advisory = (module, severity, ...pathLists) => ({
  module_name: module,
  severity,
  title: `${module} is vulnerable`,
  url: `https://github.com/advisories/${module}`,
  vulnerable_versions: '<2.0.0',
  findings: pathLists.map((paths) => ({version: '1.0.0', paths})),
});

const report = (...advisories) => ({
  advisories: Object.fromEntries(advisories.map((entry, index) => [String(index + 1), entry])),
});

const IMPORTERS = ['.', 'packages__twopoint5d'];

describe('importerId()', () => {
  it('writes the root as a dot and any other directory with __ for each slash', () => {
    assert.equal(importerId('.'), '.');
    assert.equal(importerId('packages/twopoint5d'), 'packages__twopoint5d');
  });
});

describe('selectAdvisories()', () => {
  it('keeps a high advisory reached from the workspace root, with its path', () => {
    assert.deepEqual(selectAdvisories(report(advisory('minimatch', 'high', ['.>nx>minimatch'])), IMPORTERS), [
      {
        severity: 'high',
        module: 'minimatch',
        vulnerableVersions: '<2.0.0',
        title: 'minimatch is vulnerable',
        url: 'https://github.com/advisories/minimatch',
        path: '.>nx>minimatch',
      },
    ]);
  });

  it('keeps a critical advisory reached from the library', () => {
    const selected = selectAdvisories(report(advisory('x', 'critical', ['packages__twopoint5d>three>x'])), IMPORTERS);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.path, 'packages__twopoint5d>three>x');
  });

  it('lists critical before high, then by module', () => {
    const selected = selectAdvisories(
      report(
        advisory('b', 'high', ['.>b']),
        advisory('z', 'critical', ['.>z']),
        advisory('a', 'high', ['.>a']),
        advisory('c', 'critical', ['.>c']),
      ),
      IMPORTERS,
    );
    assert.deepEqual(
      selected.map(({severity, module}) => `${severity} ${module}`),
      ['critical c', 'critical z', 'high a', 'high b'],
    );
  });

  it('leaves out an advisory that only the browser tests or the lookbook reach', () => {
    const testing = advisory('deepmerge', 'high', ['packages__twopoint5d-testing>@web/test-runner>@web/dev-server>deepmerge']);
    const lookbook = advisory('astro-thing', 'high', ['apps__lookbook>astro>astro-thing']);
    assert.deepEqual(selectAdvisories(report(testing), IMPORTERS), []);
    assert.deepEqual(selectAdvisories(report(lookbook), IMPORTERS), []);
  });

  it('leaves out moderate, low and info advisories', () => {
    for (const severity of ['moderate', 'low', 'info']) {
      assert.deepEqual(selectAdvisories(report(advisory('x', severity, ['.>x'])), IMPORTERS), [], severity);
    }
  });

  it('takes the path from the finding that the workspace root reaches', () => {
    const selected = selectAdvisories(report(advisory('x', 'high', ['apps__lookbook>astro>x'], ['.>nx>x'])), IMPORTERS);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.path, '.>nx>x');
  });

  it('throws for anything that is no report of pnpm audit', () => {
    for (const bad of [{}, null, {advisories: null}, {advisories: []}]) {
      assert.throws(() => selectAdvisories(bad, IMPORTERS), /no "advisories" object/, JSON.stringify(bad));
    }
  });
});
