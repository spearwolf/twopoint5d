import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';

// an entry is the tarball of one task's outputs, the largest (the lookbook's dist) some
// 20 MiB; the bound keeps a runaway Content-Length from filling the runner's disk
export const MAX_ENTRY_BYTES = 512 * 1024 * 1024;

// what `node:http` (`aborted`, measured under Node 24.21 as ECONNRESET without a `syscall`)
// and `stream.pipeline` report when the client closes the connection before the body is
// through
const CLIENT_GONE = new Set(['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE']);

/**
 * Nx indexes its local cache in a database named after the machine id, so a new CI runner
 * does not know a restored cache directory. Nx does take task results from a remote cache
 * that follows its OpenAPI spec (`/v1/cache/{hash}`), and this server answers that spec
 * from a plain directory the workflow saves and restores with actions/cache.
 *
 * Returns an `http.Server` that is not listening yet.
 *
 * `maxEntryBytes` is the largest entry a PUT may declare in its Content-Length; a spec sets
 * it small.
 */
export function createCacheServer({dir, token, maxEntryBytes = MAX_ENTRY_BYTES}) {
  // compared as SHA-256 digests: crypto.timingSafeEqual takes two buffers of one
  // length, and a digest has that length whatever the client sends
  const expectedDigest = sha256(`Bearer ${token}`);

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      logFailure(req, err);
      if (!res.headersSent) {
        reply(req, res, 500);
      } else {
        res.destroy();
      }
    });
  });

  async function handle(req, res) {
    const match = /^\/v1\/cache\/([^/]+)$/.exec(new URL(req.url, 'http://localhost').pathname);
    if (!match) return reply(req, res, 404);
    if (req.method !== 'GET' && req.method !== 'PUT') return reply(req, res, 405);
    if (!authorized(req)) return reply(req, res, req.method === 'GET' ? 403 : 401);

    const hash = /** @type {string} */ (match[1]);
    // Nx hashes are digit strings of some twenty digits; anything else could name a path
    // outside dir, and a name past 128 characters — the partial file adds some thirty — runs
    // into the 255 bytes a file name may have
    if (!/^[A-Za-z0-9]{1,128}$/.test(hash)) return reply(req, res, 400);

    const file = path.join(dir, hash);
    return req.method === 'GET' ? serve(req, res, file) : store(req, res, hash, file);
  }

  function authorized(req) {
    return crypto.timingSafeEqual(sha256(req.headers.authorization ?? ''), expectedDigest);
  }

  async function serve(req, res, file) {
    // the open handle reads the entry even if a cleanup run removes its name from now on
    let handle;
    try {
      handle = await fs.promises.open(file, 'r');
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return reply(req, res, 404);
      throw err;
    }
    let stream;
    let size;
    try {
      size = (await handle.stat()).size;
      // the workflow drops every entry whose mtime is older than the server start before it
      // saves the cache
      const now = new Date();
      await handle.utimes(now, now);
      stream = handle.createReadStream();
    } finally {
      // the stream closes the handle itself, once it has taken it over
      if (stream === undefined) await handle.close();
    }
    res.writeHead(200, {'Content-Type': 'application/octet-stream', 'Content-Length': size});
    await pipeline(stream, res).catch((err) => {
      // the 200 is on its way already, nothing is left to answer with
      if (!clientWentAway(err)) logFailure(req, err);
      res.destroy();
    });
  }

  async function store(req, res, hash, file) {
    if (req.headers['content-length'] === undefined) return reply(req, res, 411);
    const expectedLength = Number(req.headers['content-length']);
    if (expectedLength > maxEntryBytes) return reply(req, res, 413);
    if (fs.existsSync(file)) return reply(req, res, 409);

    const partial = path.join(dir, `.${hash}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.partial`);
    const out = fs.createWriteStream(partial, {flags: 'wx'});
    try {
      await pipeline(req, out);
    } catch (err) {
      await fs.promises.rm(partial, {force: true});
      if (!clientWentAway(err)) {
        // the disk or the directory failed, and the client is still waiting for an answer
        throw err;
      }
      // the client went away mid-body; nobody is left to answer
      res.destroy();
      return;
    }

    let status;
    try {
      status = out.bytesWritten === expectedLength ? await publish(partial, file) : 400;
    } finally {
      await fs.promises.rm(partial, {force: true});
    }
    reply(req, res, status);
  }
}

async function publish(partial, file) {
  try {
    // entries are immutable: the first writer wins, a later one gets 409
    await fs.promises.link(partial, file);
    return 200;
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EEXIST') return 409;
    throw err;
  }
}

function clientWentAway(err) {
  return CLIENT_GONE.has(err?.code);
}

// the headers stay out of the log: `Authorization` carries the token
function logFailure(req, err) {
  console.error(`nx cache server: ${req.method} ${req.url} failed: ${err instanceof Error ? err.message : String(err)}`);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest();
}

function reply(req, res, status) {
  // drop an unread request body so the connection stays usable
  req.resume();
  res.writeHead(status).end();
}
