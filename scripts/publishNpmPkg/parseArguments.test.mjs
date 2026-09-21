import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {parseArguments} from './parseArguments.mjs';

describe('parseArguments', () => {
  it('a package directory alone is a real publish', () => {
    assert.deepEqual(parseArguments(['dist']), {packageDir: 'dist', dryRun: false});
  });

  it('--dry-run is read on either side of the package directory', () => {
    assert.deepEqual(parseArguments(['dist', '--dry-run']), {packageDir: 'dist', dryRun: true});
    assert.deepEqual(parseArguments(['--dry-run', 'dist']), {packageDir: 'dist', dryRun: true});
  });

  it('a bare -- in front of the options is skipped', () => {
    assert.deepEqual(parseArguments(['dist', '--', '--dry-run']), {packageDir: 'dist', dryRun: true});
  });

  it('a missing package directory throws', () => {
    assert.throws(() => parseArguments([]), /missing <package-dir>/);
    assert.throws(() => parseArguments(['--dry-run']), /missing <package-dir>/);
  });

  it('an unknown option throws, even when it looks like a misspelled --dry-run', () => {
    for (const arg of ['--dryrun', '--dry-run=true', '-n']) {
      assert.throws(() => parseArguments(['dist', arg]), new RegExp(`unknown option: ${arg}`));
    }
  });

  it('a second package directory throws', () => {
    assert.throws(() => parseArguments(['dist', 'other']), /expected one <package-dir>, got 2: dist other/);
  });
});
