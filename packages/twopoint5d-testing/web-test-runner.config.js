import { esbuildPlugin } from '@web/dev-server-esbuild';
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  nodeResolve: true,
  // in a monorepo you need to set set the root dir to resolve modules
  rootDir: '../../',
  files: 'test/**/*.test.js',
  plugins: [
    esbuildPlugin({ target: 'auto' }),
  ],
  browsers: [
    playwrightLauncher({ product: 'chromium', concurrency: 1 }),
    playwrightLauncher({ product: 'firefox', concurrency: 1 }),
  ],
  testFramework: {
    config: {
      ui: 'bdd',
      timeout: '2000',
    },
  },
  testRunnerHtml: testFramework =>
    `<!DOCTYPE html>
    <html>
      <body>
        <canvas id="test-canvas" resize-to="fullscreen"></canvas>
        <script>window.process = { env: { NODE_ENV: "development" } }</script>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>`,
};
