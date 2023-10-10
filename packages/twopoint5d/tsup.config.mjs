import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'tsup';
import {makeBanner} from '../../scripts/makeBanner.mjs';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  outDir: 'dist/lib',
  banner: {js: makeBanner(projectDir)},
  target: 'es2022',
  dts: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  clean: true,
});
