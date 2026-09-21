import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';

/**
 * Nx indexes its local cache in a database named after the machine id, so a new CI runner
 * does not know a restored cache directory. Nx does take task results from a remote cache
 * that follows its OpenAPI spec (`/v1/cache/{hash}`), and this server answers that spec
 * from a plain directory the workflow saves and restores with actions/cache.
 *
 * Returns an `http.Server` that is not listening yet.
 */
export function createCacheServer({dir, token}) {
  const expectedAuthorization = `Bearer ${token}`;

  return http.createServer((req, res) => {
    handle(req, res).catch(() => {
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
    if (req.headers.authorization !== expectedAuthorization) return reply(req, res, req.method === 'GET' ? 403 : 401);

    const hash = match[1];
    // Nx hashes are digit strings; anything else could name a path outside dir
    if (!/^[A-Za-z0-9]+$/.test(hash)) return reply(req, res, 400);

    const file = path.join(dir, hash);
    return req.method === 'GET' ? serve(req, res, file) : store(req, res, hash, file);
  }

  async function serve(req, res, file) {
    let stat;
    try {
      stat = await fs.promises.stat(file);
    } catch (err) {
      if (err.code === 'ENOENT') return reply(req, res, 404);
      throw err;
    }
    // the workflow drops every entry whose mtime is older than the server start before it saves the cache
    const now = new Date();
    await fs.promises.utimes(file, now, now);
    res.writeHead(200, {'Content-Type': 'application/octet-stream', 'Content-Length': stat.size});
    await pipeline(fs.createReadStream(file), res).catch(() => res.destroy());
  }

  async function store(req, res, hash, file) {
    if (req.headers['content-length'] === undefined) return reply(req, res, 411);
    if (fs.existsSync(file)) return reply(req, res, 409);

    const expectedLength = Number(req.headers['content-length']);
    const partial = path.join(dir, `.${hash}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.partial`);
    const out = fs.createWriteStream(partial, {flags: 'wx'});
    try {
      await pipeline(req, out);
    } catch {
      // the client went away mid-body; nobody is left to answer
      await fs.promises.rm(partial, {force: true});
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
    if (err.code === 'EEXIST') return 409;
    throw err;
  }
}

function reply(req, res, status) {
  // drop an unread request body so the connection stays usable
  req.resume();
  res.writeHead(status).end();
}
