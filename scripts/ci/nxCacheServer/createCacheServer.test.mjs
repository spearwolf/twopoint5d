import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {afterEach, beforeEach, test} from 'node:test';
import {createCacheServer, MAX_ENTRY_BYTES} from './createCacheServer.mjs';

const TOKEN = 'secret';

let root;
let dir;
let server;
let baseUrl;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'nx-cache-server-'));
  // the served directory sits two levels down, so a hash that climbs two levels out
  // of it still lands inside root
  dir = path.join(root, 'parent', 'cache');
  fs.mkdirSync(dir, {recursive: true});
  server = createCacheServer({dir, token: TOKEN});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`;
});

afterEach(async () => {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  fs.rmSync(root, {recursive: true, force: true});
});

const auth = (token = TOKEN) => ({Authorization: `Bearer ${token}`});

const get = (hash, token) => fetch(`${baseUrl}/v1/cache/${hash}`, {headers: auth(token)});

const put = (hash, body, token) =>
  fetch(`${baseUrl}/v1/cache/${hash}`, {
    method: 'PUT',
    headers: {...auth(token), 'Content-Type': 'application/octet-stream'},
    body,
  });

async function waitFor(condition, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) return false;
    await sleep(10);
  }
  return true;
}

test('GET of an unknown hash answers 404', async () => {
  const res = await get('123');
  assert.equal(res.status, 404);
});

test('PUT stores an entry that GET returns byte for byte', async () => {
  const body = Buffer.from(Array.from({length: 4096}, (_, i) => i % 256));
  assert.equal((await put('123', body)).status, 200);

  const res = await get('123');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/octet-stream');
  assert.equal(res.headers.get('content-length'), String(body.length));
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), body);
});

test('a second PUT on the same hash answers 409 and leaves the entry alone', async () => {
  assert.equal((await put('123', Buffer.from('first'))).status, 200);
  assert.equal((await put('123', Buffer.from('second'))).status, 409);
  assert.equal(fs.readFileSync(path.join(dir, '123'), 'utf8'), 'first');
});

test('a wrong token gets 403 on GET and 401 on PUT, and stores nothing', async () => {
  assert.equal((await get('123', 'wrong')).status, 403);
  assert.equal((await put('123', Buffer.from('data'), 'wrong')).status, 401);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('the token is compared in constant time, as two digests of one length, whatever the client sends', async (t) => {
  const compare = t.mock.method(crypto, 'timingSafeEqual');
  assert.equal((await get('123', 'a-token-far-longer-than-the-right-one')).status, 403);
  assert.equal((await fetch(`${baseUrl}/v1/cache/123`)).status, 403);
  assert.equal((await get('123')).status, 404);
  assert.equal(compare.mock.callCount(), 3);
  for (const call of compare.mock.calls) {
    const [a, b] = call.arguments;
    assert.equal(a.byteLength, b.byteLength);
  }
});

test('a hash that is not alphanumeric answers 400 and writes nothing outside the directory', async () => {
  for (const hash of ['..%2F..%2Fx', 'a.b']) {
    assert.equal((await get(hash)).status, 400, `GET ${hash}`);
    assert.equal((await put(hash, Buffer.from('data'))).status, 400, `PUT ${hash}`);
  }
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.deepEqual(fs.readdirSync(path.dirname(dir)), ['cache']);
  assert.deepEqual(fs.readdirSync(root), ['parent']);
});

test('a hash longer than 128 characters answers 400 on GET and PUT, one of 128 is stored', async () => {
  const tooLong = '1'.repeat(129);
  assert.equal((await get(tooLong)).status, 400, 'GET');
  assert.equal((await put(tooLong, Buffer.from('data'))).status, 400, 'PUT');
  assert.deepEqual(fs.readdirSync(dir), []);

  const longest = '1'.repeat(128);
  assert.equal((await put(longest, Buffer.from('data'))).status, 200);
  assert.equal((await get(longest)).status, 200);
});

test('a PUT above the entry limit answers 413 and stores nothing', async () => {
  const small = createCacheServer({dir, token: TOKEN, maxEntryBytes: 16});
  await new Promise((resolve) => small.listen(0, '127.0.0.1', () => resolve(undefined)));
  const smallUrl = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (small.address()).port}`;
  const putSmall = (hash, body) =>
    fetch(`${smallUrl}/v1/cache/${hash}`, {
      method: 'PUT',
      headers: {...auth(), 'Content-Type': 'application/octet-stream'},
      body,
    });
  try {
    assert.equal((await putSmall('123', Buffer.alloc(17, 1))).status, 413);
    assert.equal((await putSmall('456', Buffer.alloc(16, 1))).status, 200);
    assert.deepEqual(fs.readdirSync(dir), ['456']);
  } finally {
    small.closeAllConnections();
    await new Promise((resolve) => small.close(resolve));
  }
});

test('the default limit is MAX_ENTRY_BYTES, refused before any body arrives', async () => {
  const status = await new Promise((resolve, reject) => {
    const req = http.request(
      `${baseUrl}/v1/cache/123`,
      {method: 'PUT', headers: {...auth(), 'Content-Length': String(MAX_ENTRY_BYTES + 1)}},
      (res) => {
        res.resume();
        resolve(res.statusCode);
        req.destroy();
      },
    );
    req.on('error', () => {});
    req.flushHeaders();
    setTimeout(() => reject(new Error('no status before a body arrived')), 3000).unref();
  });
  assert.equal(status, 413);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('GET refreshes the mtime of the entry it serves', async () => {
  const testStart = Date.now();
  const file = path.join(dir, '123');
  fs.writeFileSync(file, 'data');
  const past = new Date('2020-01-01T00:00:00Z');
  fs.utimesSync(file, past, past);

  const res = await get('123');
  assert.equal(res.status, 200);
  await res.arrayBuffer();

  // file systems with a coarse mtime may round down to the second
  assert.ok(fs.statSync(file).mtimeMs >= Math.floor(testStart / 1000) * 1000);
});

test('a GET whose entry vanishes as the server refreshes its mtime serves the entry whole', async (t) => {
  const file = path.join(dir, '123');
  fs.writeFileSync(file, 'data');
  const handle = await fs.promises.open(file, 'r');
  const handlePrototype = Object.getPrototypeOf(handle);
  await handle.close();

  // a cleanup run removes the entry just as the server touches it, whichever way it does
  const vanishing = (/** @type {(...args: any[]) => unknown} */ original) =>
    /** @this {unknown} */
    function (...args) {
      fs.rmSync(file, {force: true});
      return original.apply(this, args);
    };
  const onPath = t.mock.method(fs.promises, 'utimes', vanishing(fs.promises.utimes));
  const onHandle = t.mock.method(handlePrototype, 'utimes', vanishing(handlePrototype.utimes));

  const res = await get('123');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'data');
  assert.ok(onPath.mock.callCount() + onHandle.mock.callCount() > 0, 'the server never refreshed the mtime');
});

test('a GET whose entry cannot be read answers 500 and logs that reason, also when the handle fails to close', async (t) => {
  const file = path.join(dir, '123');
  fs.writeFileSync(file, 'data');
  const handle = await fs.promises.open(file, 'r');
  const handlePrototype = Object.getPrototypeOf(handle);
  await handle.close();

  t.mock.method(handlePrototype, 'stat', async () => {
    throw new Error('stat failed');
  });
  // close() is a property of each handle, not of the prototype: the open() of the server hands out
  // handles whose close() frees the descriptor, then reports its own failure
  const open = fs.promises.open;
  t.mock.method(fs.promises, 'open', async (/** @type {Parameters<typeof open>} */ ...args) => {
    const opened = await open(...args);
    const close = opened.close.bind(opened);
    opened.close = async () => {
      await close();
      throw new Error('close failed');
    };
    return opened;
  });
  const logged = t.mock.method(console, 'error', () => {});

  const res = await get('123');

  assert.equal(res.status, 500);
  assert.equal(logged.mock.callCount(), 1);
  assert.match(String(logged.mock.calls[0]?.arguments[0]), /^nx cache server: GET \/v1\/cache\/123 failed: stat failed$/);
});

test('a PUT whose entry cannot be written answers 500 and logs the method, the path and the reason', async (t) => {
  fs.rmSync(dir, {recursive: true});
  const logged = t.mock.method(console, 'error', () => {});

  const res = await put('123', 'data');

  assert.equal(res.status, 500);
  assert.equal(logged.mock.callCount(), 1);
  assert.match(String(logged.mock.calls[0]?.arguments[0]), /^nx cache server: PUT \/v1\/cache\/123 failed: ENOENT/);
});

test('PUT without Content-Length answers 411', async () => {
  const status = await new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}/v1/cache/123`, {method: 'PUT', headers: auth()}, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    // two writes without a declared length make node:http send the body chunked
    req.write('chunk one');
    req.end('chunk two');
  });
  assert.equal(status, 411);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('a PUT the client aborts halfway leaves neither the entry nor a partial file', async (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  const req = http.request(`${baseUrl}/v1/cache/123`, {
    method: 'PUT',
    headers: {...auth(), 'Content-Length': '1000'},
  });
  req.on('error', () => {});
  req.write(Buffer.alloc(500, 1));
  // the server has to be writing before the abort, otherwise there is nothing to clean up
  assert.ok(await waitFor(() => fs.readdirSync(dir).length > 0, 1000), 'server never started writing');
  req.destroy();

  assert.ok(await waitFor(() => fs.readdirSync(dir).length === 0, 1000), `left behind: ${fs.readdirSync(dir)}`);
  // a client that went away is no failure of the server
  assert.equal(logged.mock.callCount(), 0);
});

test('an unknown method answers 405 and an unknown path 404', async () => {
  const del = await fetch(`${baseUrl}/v1/cache/123`, {method: 'DELETE', headers: auth()});
  assert.equal(del.status, 405);
  const other = await fetch(`${baseUrl}/v2/cache/1`, {headers: auth()});
  assert.equal(other.status, 404);
});
