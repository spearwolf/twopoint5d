import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createCacheServer} from './nxCacheServer/createCacheServer.mjs';

const USAGE = 'usage: NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<token> node scripts/ci/nxCacheServer.mjs --dir <path> --port <n>';

let values;
try {
  ({values} = parseArgs({options: {dir: {type: 'string'}, port: {type: 'string'}}}));
} catch {
  values = {};
}

// the same variable Nx reads, so the server and its client cannot disagree on the token
const token = process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN;
const port = Number(values.port);

if (!values.dir || !Number.isInteger(port) || !token) {
  console.error(USAGE);
  process.exit(1);
}

const dir = path.resolve(values.dir);
fs.mkdirSync(dir, {recursive: true});

const server = createCacheServer({dir, token});

server.on('error', (err) => {
  console.error(`nx cache server: ${err.message}`);
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`nx cache server listening on http://127.0.0.1:${server.address().port}, serving ${dir}`);
});
