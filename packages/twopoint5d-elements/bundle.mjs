import * as esbuild from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {makeBanner} from '../../scripts/makeBanner.mjs';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
// const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json')));

const buildDir = path.join(projectDir, 'build');
const distDir = path.join(projectDir, 'dist');

await esbuild.build({
  entryPoints: [path.join(buildDir, 'src/bundle.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2017'],
  banner: {js: makeBanner(projectDir, 'bundle')},
  outfile: `${distDir}/bundle.js`,
});
