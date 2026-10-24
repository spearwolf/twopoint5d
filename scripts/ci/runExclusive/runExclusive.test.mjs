import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../runExclusive.mjs', import.meta.url));

let dir;
let lock;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-exclusive-'));
  lock = path.join(dir, 'gate.lock');
});

afterEach(() => {
  fs.rmSync(dir, {recursive: true, force: true});
});

// the command of every run is a Node one-liner, so the specs need nothing but Node
const run = (code, lockArgs = ['--lock', lock]) =>
  spawnSync(process.execPath, [script, ...lockArgs, '--', process.execPath, '-e', code], {
    encoding: 'utf8',
    timeout: 10_000,
  });

/** the pid of a process that has ended */
const deadPid = () => {
  const {pid} = spawnSync(process.execPath, ['-e', '']);
  assert.ok(pid);
  return pid;
};

const writeLock = (owner) => fs.writeFileSync(lock, `${JSON.stringify(owner)}\n`);

describe('runExclusive.mjs', () => {
  it('holds the lock in its own name while the command runs, passes its exit code on and releases the lock', () => {
    const {status, stderr} = run(
      `const owner = JSON.parse(require('node:fs').readFileSync(${JSON.stringify(lock)}, 'utf8'));
       process.exit(owner.pid === process.ppid ? 3 : 4);`,
    );
    assert.equal(status, 3, stderr);
    assert.equal(fs.existsSync(lock), false);
    assert.deepEqual(fs.readdirSync(dir), []);
  });

  it('refuses while a live process holds the lock, runs nothing and leaves the lock alone: exit code 1', () => {
    const owner = {pid: process.pid, startedAt: '2026-10-24T07:02:46.000Z', command: 'pnpm run ci:gate'};
    writeLock(owner);
    const marker = path.join(dir, 'ran');
    const {status, stderr} = run(`require('node:fs').writeFileSync(${JSON.stringify(marker)}, '')`);
    assert.equal(status, 1, stderr);
    assert.equal(
      stderr,
      `runExclusive: ${lock} is held by process ${process.pid} since 2026-10-24T07:02:46.000Z (pnpm run ci:gate).` +
        ' Two runs in one checkout break each other; wait for that one to end, or run the second in a git worktree.' +
        ` If process ${process.pid} is no such run, delete ${lock}.\n`,
    );
    assert.equal(fs.existsSync(marker), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(lock, 'utf8')), owner);
  });

  it('takes over a lock whose process has ended', () => {
    writeLock({pid: deadPid(), startedAt: '2026-10-24T07:02:46.000Z', command: 'pnpm run ci:gate'});
    const {status, stderr} = run('process.exit(0)');
    assert.equal(status, 0, stderr);
    assert.equal(fs.existsSync(lock), false);
  });

  it('takes over a lock that names no process', () => {
    fs.writeFileSync(lock, '');
    const {status, stderr} = run('process.exit(0)');
    assert.equal(status, 0, stderr);
    assert.equal(fs.existsSync(lock), false);
  });

  it('dies of the signal its command died of, and releases the lock', () => {
    const {status, signal, stderr} = run(`process.kill(process.pid, 'SIGTERM')`);
    assert.equal(status, null, stderr);
    assert.equal(signal, 'SIGTERM');
    assert.equal(fs.existsSync(lock), false);
  });

  it('hands a SIGTERM on to its command and waits for it to end before it releases the lock', async () => {
    // a command that never hears the SIGTERM ends on its own with 9, so the spec fails
    // instead of waiting forever
    const wrapper = spawn(
      process.execPath,
      [
        script,
        '--lock',
        lock,
        '--',
        process.execPath,
        '-e',
        `process.on('SIGTERM', () => process.exit(7)); console.log('ready'); setTimeout(() => process.exit(9), 10_000);`,
      ],
      {stdio: ['ignore', 'pipe', 'pipe']},
    );
    const exited = new Promise((resolve) => wrapper.on('exit', (code, signal) => resolve({code, signal})));
    await Promise.race([new Promise((resolve) => wrapper.stdout.once('data', resolve)), exited]);
    assert.equal(fs.existsSync(lock), true);
    wrapper.kill('SIGTERM');
    assert.deepEqual(await exited, {code: 7, signal: null});
    assert.equal(fs.existsSync(lock), false);
  });

  it('releases the lock and exits with 1 when the command cannot start', () => {
    const {status, stderr} = spawnSync(process.execPath, [script, '--lock', lock, '--', path.join(dir, 'no-such-command')], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(status, 1, stderr);
    assert.match(stderr, /^runExclusive: cannot start .*no-such-command: /);
    assert.equal(fs.existsSync(lock), false);
  });

  it('prints the usage line alone without --lock or without a command: exit code 1', () => {
    for (const args of [
      ['--', process.execPath, '-e', ''],
      ['--lock', lock],
    ]) {
      const {status, stderr} = spawnSync(process.execPath, [script, ...args], {encoding: 'utf8', timeout: 10_000});
      assert.equal(status, 1, `${args.join(' ')}: ${stderr}`);
      assert.match(stderr, /^usage: [^\n]*\n$/, args.join(' '));
    }
    assert.equal(fs.existsSync(lock), false);
  });
});
