import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {afterEach, beforeEach, test} from 'node:test';
import {createCacheServer} from './createCacheServer.mjs';

const TOKEN = 'secret';

let root;
let dir;
let server;
let baseUrl;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'nx-cache-server-'));
  // the served directory sits one level down, so a path that escapes it still lands inside root
  dir = path.join(root, 'cache');
  fs.mkdirSync(dir);
  server = createCacheServer({dir, token: TOKEN});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
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

test('a hash that is not alphanumeric answers 400 and writes nothing outside the directory', async () => {
  for (const hash of ['..%2F..%2Fx', 'a.b']) {
    assert.equal((await get(hash)).status, 400, `GET ${hash}`);
    assert.equal((await put(hash, Buffer.from('data'))).status, 400, `PUT ${hash}`);
  }
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.deepEqual(fs.readdirSync(root), ['cache']);
  assert.equal(fs.existsSync(path.join(dir, '..', '..', 'x')), false);
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

test('a PUT the client aborts halfway leaves neither the entry nor a partial file', async () => {
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
});

test('an unknown method answers 405 and an unknown path 404', async () => {
  const del = await fetch(`${baseUrl}/v1/cache/123`, {method: 'DELETE', headers: auth()});
  assert.equal(del.status, 405);
  const other = await fetch(`${baseUrl}/v2/cache/1`, {headers: auth()});
  assert.equal(other.status, 404);
});
