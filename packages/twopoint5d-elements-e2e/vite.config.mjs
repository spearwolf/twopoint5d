import {dirname, basename, resolve} from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import {readdirSync} from 'fs';

const projectRoot = dirname(fileURLToPath(import.meta.url));

const resolvePage = (path) => resolve(projectRoot, 'pages', path);

const pages = Object.fromEntries(
  readdirSync(resolve(projectRoot, 'pages'))
    .filter((file) => file.endsWith('.html'))
    .map((file) => [basename(file, '.html'), resolvePage(file)]),
);

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        ...pages,
        main: resolve(projectRoot, 'index.html'),
      },
    },
  },
});
