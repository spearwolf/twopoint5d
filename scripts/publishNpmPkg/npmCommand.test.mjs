import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {npmCommand} from './npmCommand.mjs';

describe('npmCommand', () => {
  it('starts npm directly outside Windows', () => {
    for (const platform of ['linux', 'darwin']) {
      assert.deepEqual(npmCommand(['show', '.', 'versions', '--json'], platform), {
        file: 'npm',
        args: ['show', '.', 'versions', '--json'],
        options: {},
      });
    }
  });

  it('hands Windows one command string for cmd.exe and no argument list', () => {
    assert.deepEqual(npmCommand(['publish', '--access', 'public', '--dry-run'], 'win32'), {
      file: 'npm publish --access public --dry-run',
      args: [],
      options: {shell: true},
    });
  });

  it('refuses an argument cmd.exe would read, on every platform', () => {
    for (const platform of ['linux', 'win32']) {
      for (const arg of ['a b', 'a&b', '%PATH%', 'a^b', 'a|b', '<a', 'a>', '(a)', '!a', '"a"', '']) {
        assert.throws(() => npmCommand(['show', arg], platform), /refusing to pass/);
      }
    }
  });
});
