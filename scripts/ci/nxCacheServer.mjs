import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createCacheServer} from './nxCacheServer/createCacheServer.mjs';

const USAGE = 'usage: NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<token> node scripts/ci/nxCacheServer.mjs --dir <path> --port <n>';

let values;
try {
  ({values} = parseArgs({options: {dir: {type: 'string'}, port: {type: 'string'}}}));
} catch (error) {
  // parseArgs names the option or the argument it refuses
  console.error(error instanceof Error ? error.message : String(error));
  console.error(USAGE);
  process.exit(1);
}

// the same variable Nx reads, so the server and its client cannot disagree on the token
const token = process.env['NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN'];
const port = Number(values.port);
// server.listen() takes a whole number from 0 (any free port) to 65535 and throws on
// anything else — past the 'error' handler below, after --dir is created
const portIsValid = /^\d+$/.test(values.port ?? '') && port <= 65535;

if (!values.dir || !portIsValid || !token) {
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
  console.log(
    `nx cache server listening on http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}, serving ${dir}`,
  );
});
