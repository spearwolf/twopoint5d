import {nodeResolve} from '@rollup/plugin-node-resolve';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {makeBanner as _makeBanner} from '../../scripts/makeBanner.mjs';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json')));

const projectShortName = path.basename(projectDir);

const buildDir = path.join(projectDir, 'build');
const distDir = path.join(projectDir, 'dist');

const makeBanner = (build) => _makeBanner(projectDir, build);

export default {
  plugins: [nodeResolve()],
  input: {
    [projectShortName]: path.join(buildDir, 'src/index.js'),
  },
  output: [
    {
      banner: makeBanner('esm'),
      dir: distDir,
      entryFileNames: '[name].mjs',
      format: 'es',
    },
    {
      banner: makeBanner('cjs'),
      dir: distDir,
      entryFileNames: '[name].cjs.js',
      format: 'commonjs',
      exports: 'named',
    },
  ],
  external: packageJson.rollup?.external,
};
