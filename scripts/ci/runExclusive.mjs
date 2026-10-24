// Runs a command as the only one of its kind in this checkout. Two runs of the gate side
// by side break each other: the `clean` of one deletes the `dist/` the browser tests of
// the other are loading, and whoever stops them leaves Nx a failed run beside a passing
// one of the same hash, which it reports as a flaky task. The lock is a file holding the
// pid of this process; a second run refuses while that process lives, and takes the lock
// over once it is gone.
//
//   node scripts/ci/runExclusive.mjs --lock <path> -- <command> [args…]
//
// Exit: the exit code of <command>, or the signal it died of, raised again; 1 when a live
// process holds <path>, when <command> cannot start, or when an argument is missing.

import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';

const USAGE = 'usage: node scripts/ci/runExclusive.mjs --lock <path> -- <command> [args…]';
const FORWARDED_SIGNALS = /** @type {const} */ (['SIGINT', 'SIGTERM', 'SIGHUP']);

let values;
let positionals;
try {
  ({values, positionals} = parseArgs({options: {lock: {type: 'string'}}, allowPositionals: true}));
} catch (error) {
  // parseArgs names the option it refuses
  console.error(error instanceof Error ? error.message : String(error));
  console.error(USAGE);
  process.exit(1);
}

const lockPath = values.lock;
const [command, ...args] = positionals;
if (!lockPath || command === undefined) {
  console.error(USAGE);
  process.exit(1);
}

/** @param {number} pid */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process lives, it only belongs to another user
    return /** @type {NodeJS.ErrnoException} */ (error).code === 'EPERM';
  }
}

/**
 * The owner written into the lock, `undefined` once the lock is gone, `null` for a file
 * that holds no owner.
 *
 * @returns {{pid: number, startedAt: string, command: string} | null | undefined}
 */
function readOwner() {
  let text;
  try {
    text = fs.readFileSync(lockPath, 'utf8');
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return undefined;
    throw error;
  }
  try {
    const owner = JSON.parse(text);
    if (Number.isInteger(owner?.pid) && owner.pid > 0) return owner;
  } catch {
    // no JSON: no owner either
  }
  return null;
}

/**
 * Takes the lock, or answers the live owner that holds it. The owner is written into a
 * file of its own first and linked to the lock after: link() fails on a lock that exists,
 * and the lock never shows a half-written owner, which a second run would take for none.
 * Taking over the lock of a dead owner is not atomic against a third run that takes it
 * over in the same moment.
 */
function acquire() {
  const owner = {pid: process.pid, startedAt: new Date().toISOString(), command: positionals.join(' ')};
  const draft = `${lockPath}.${process.pid}`;
  // the lock runs before Nx, which creates .nx only on its first run: a fresh clone or a
  // new worktree has no such directory yet
  fs.mkdirSync(path.dirname(lockPath), {recursive: true});
  fs.writeFileSync(draft, `${JSON.stringify(owner)}\n`);
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.linkSync(draft, lockPath);
        return null;
      } catch (error) {
        if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'EEXIST') throw error;
      }
      const holder = readOwner();
      if (holder != null && isAlive(holder.pid)) return holder;
      // its owner is gone, or the file never named one
      if (holder !== undefined) fs.rmSync(lockPath, {force: true});
    }
    throw new Error(`runExclusive: cannot take ${lockPath}, it changes hands faster than it can be read`);
  } finally {
    fs.rmSync(draft, {force: true});
  }
}

function release() {
  if (readOwner()?.pid === process.pid) fs.rmSync(lockPath, {force: true});
}

const holder = acquire();
if (holder !== null) {
  console.error(
    `runExclusive: ${lockPath} is held by process ${holder.pid} since ${holder.startedAt} (${holder.command}).` +
      ' Two runs in one checkout break each other; wait for that one to end, or run the second in a git worktree.' +
      ` If process ${holder.pid} is no such run, delete ${lockPath}.`,
  );
  process.exit(1);
}

// a crash of this script must not leave a lock behind that names a live process
process.on('exit', release);

const child = spawn(command, args, {stdio: 'inherit'});

// the lock is released once the command has ended, so a signal goes on to the command,
// and this process waits for it
for (const signal of FORWARDED_SIGNALS) process.on(signal, () => child.kill(signal));

child.on('error', (error) => {
  console.error(`runExclusive: cannot start ${command}: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  release();
  if (signal !== null) {
    for (const forwarded of FORWARDED_SIGNALS) process.removeAllListeners(forwarded);
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
