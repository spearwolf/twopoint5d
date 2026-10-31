import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../auditInstalledDependencies.mjs', import.meta.url));

let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-installed-'));
});

afterEach(() => {
  fs.rmSync(dir, {recursive: true, force: true});
});

const advisories = (module, severity, paths) => ({
  advisories: {
    1: {
      module_name: module,
      severity,
      title: 'a flaw',
      url: 'https://example.test/1',
      vulnerable_versions: '<2.0.0',
      findings: [{version: '1.0.0', paths}],
    },
  },
});

/** @param {string | object} report the content of the report file */
const audit = (report, extraArgs = ['--importer', '.', '--importer', 'packages/twopoint5d']) => {
  const file = path.join(dir, 'report.json');
  fs.writeFileSync(file, typeof report === 'string' ? report : JSON.stringify(report));
  return spawnSync(process.execPath, [script, '--report', file, ...extraArgs], {encoding: 'utf8', timeout: 10_000});
};

describe('auditInstalledDependencies.mjs', () => {
  it('exits with 1 on an advisory the root reaches, and names module and path on stderr', () => {
    const {status, stderr} = audit(advisories('minimatch', 'high', ['.>nx>minimatch']));
    assert.equal(status, 1, stderr);
    assert.match(stderr, /^high minimatch <2\.0\.0: a flaw \(https:\/\/example\.test\/1\), reached through \.>nx>minimatch\n/);
    assert.match(stderr, /auditInstalledDependencies: 1 high or critical advisories reached from \., packages\/twopoint5d\n$/);
  });

  it('exits with 0 and says so on stdout when no advisory is reached', () => {
    const {status, stdout, stderr} = audit(
      advisories('deepmerge', 'high', ['packages__twopoint5d-testing>@web/test-runner>deepmerge']),
    );
    assert.equal(status, 0, stderr);
    assert.equal(stdout, 'auditInstalledDependencies: no high or critical advisory reached from ., packages/twopoint5d\n');
  });

  it('exits with 2 on an empty file, on no JSON and on JSON that is no report', () => {
    for (const content of ['', 'npm notice nothing', '{}']) {
      const {status, stderr} = audit(content);
      assert.equal(status, 2, `${JSON.stringify(content)}: ${stderr}`);
      assert.match(stderr, /^auditInstalledDependencies: .*report\.json /, JSON.stringify(content));
    }
  });

  it('exits with 2 and the usage line without --report and without --importer', () => {
    const {status, stderr} = spawnSync(process.execPath, [script], {encoding: 'utf8', timeout: 10_000});
    assert.equal(status, 2, stderr);
    assert.match(stderr, /^usage: [^\n]*\n$/);
  });

  it('exits with 2 for a report file that does not exist', () => {
    const {status, stderr} = spawnSync(
      process.execPath,
      [script, '--report', path.join(dir, 'missing.json'), '--importer', '.'],
      {
        encoding: 'utf8',
        timeout: 10_000,
      },
    );
    assert.equal(status, 2, stderr);
  });
});
