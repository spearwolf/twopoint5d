import {esbuildPlugin} from '@web/dev-server-esbuild';
import {defaultReporter} from '@web/test-runner';
import {playwrightLauncher} from '@web/test-runner-playwright';

export default {
  nodeResolve: true,
  // in a monorepo you need to set set the root dir to resolve modules
  rootDir: '../../',
  files: 'test/**/*.test.js',
  reporters: [defaultReporter({reportTestResults: true, reportTestProgress: false})],
  plugins: [esbuildPlugin({target: 'auto'})],
  browsers: [
    // https://modern-web.dev/docs/test-runner/browser-launchers/playwright/
    playwrightLauncher({
      product: 'chromium',
      concurrency: 1,
      // --enable-precise-memory-info: without it, performance.memory.usedJSHeapSize is
      // quantized to a fixed bucket and never moves. --js-flags=--expose-gc: without it,
      // there is no way to force a GC before a heap sample, so samples aren't comparable.
      launchOptions: {args: ['--enable-precise-memory-info', '--js-flags=--expose-gc']},
    }),
    playwrightLauncher({
      product: 'firefox',
      concurrency: 1,
      launchOptions: {
        headless: true,
        // devtools: true,
        // args: ['--some-flag'],
        firefoxUserPrefs: {
          'dom.webgpu.enabled': true,
          // Firefox probes the GL driver in a child process (glxtest) at startup and waits at most
          // 4 seconds for it. On a loaded CI runner with cold caches, llvmpipe can miss that window;
          // Firefox then treats GL as blocked for the whole session and every getContext('webgl2')
          // returns null ("AllowWebgl2:false restricts context creation on this system").
          // force-enabled skips that gate and creates the context through the driver directly.
          'webgl.force-enabled': true,
        },
      },
    }),
  ],
  testFramework: {
    config: {
      ui: 'bdd',
      timeout: '10000',
    },
  },
  testRunnerHtml: (testFramework) =>
    `<!DOCTYPE html>
    <html>
      <body>
        <canvas id="test-canvas" resize-to="fullscreen"></canvas>
        <script>window.process = { env: { NODE_ENV: "development" } }</script>
        <script>
          // A failed WebGL context creation only surfaces as "this.gl is null" deep inside three.
          // Log the reason the browser gives, so a CI log names the actual cause.
          (() => {
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
              let reason = '';
              const onError = (event) => { reason = event.statusMessage; };
              this.addEventListener('webglcontextcreationerror', onError);
              const ctx = getContext.call(this, kind, ...args);
              this.removeEventListener('webglcontextcreationerror', onError);
              if (ctx === null && (kind === 'webgl2' || kind === 'webgl')) {
                console.error('[test-runner] getContext(' + kind + ') failed:', reason || '(no reason given)');
              }
              return ctx;
            };
          })();
        </script>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>`,
};
