import {esbuildPlugin} from '@web/dev-server-esbuild';
import {defaultReporter} from '@web/test-runner';
import {playwrightLauncher} from '@web/test-runner-playwright';

/** @typedef {'WebGPU' | 'WebGL2'} Backend */

/**
 * A Playwright launcher whose pages render under `backend`, named after both — the reporter
 * keys its results and browser logs by that name.
 *
 * @param {'chromium' | 'firefox'} product
 * @param {Backend} backend
 * @param {import('playwright').LaunchOptions} launchOptions
 */
function backendLauncher(product, backend, launchOptions) {
  const launcher = playwrightLauncher({
    product,
    concurrency: 1,
    launchOptions,
    async createPage({context}) {
      await context.addInitScript(pinBackend, backend);
      return context.newPage();
    },
  });
  launcher.name = `${launcher.name} ${backend}`;
  return launcher;
}

/**
 * Runs in the page before any of its scripts. It leaves the backend the tests expect in
 * `globalThis.twopoint5dTestBackend`, which `expectedBackend()` in test/helpers/fixtures.js
 * reads. For WebGL2 it takes `navigator.gpu` away, as a browser without WebGPU has none:
 * three's WebGPU backend then fails its init and the renderer falls back to WebGL2 — the
 * path a user without WebGPU takes, and not `forceWebGL`, which skips it.
 *
 * @param {Backend} backend
 */
function pinBackend(backend) {
  Object.defineProperty(globalThis, 'twopoint5dTestBackend', {value: backend});
  if (backend === 'WebGL2') delete Navigator.prototype.gpu;
}

export default {
  nodeResolve: true,
  // in a monorepo you need to set set the root dir to resolve modules
  rootDir: '../../',
  files: 'test/**/*.test.js',
  reporters: [defaultReporter({reportTestResults: true, reportTestProgress: false})],
  plugins: [esbuildPlugin({target: 'auto'})],
  // Every test file runs under both backends of three's WebGPURenderer. Which one a browser
  // would pick on its own depends on the machine — headless Chromium has no WebGPU without a
  // flag, headless Firefox has no adapter at all — so each launcher pins its backend and
  // renderer-backend.test.js fails when three ends up on another one.
  browsers: [
    backendLauncher('chromium', 'WebGPU', {
      // the first two flags as for Chromium WebGL2 below, for the heap samples.
      // --enable-unsafe-webgpu: headless Chromium offers no adapter without it.
      // --use-webgpu-adapter=swiftshader: the software adapter Chromium ships, so a machine
      // without a GPU — the CI runner — renders as a developer's machine does.
      // --use-angle=swiftshader, --enable-features=Vulkan, --use-vulkan=swiftshader: the
      // compositor has to run on SwiftShader as well, on Linux through Vulkan. Otherwise it
      // cannot take the canvas texture of a SwiftShader device: the first getCurrentTexture()
      // comes back invalid, and Dawn drops the instance — every device of the page is lost
      // ("A valid external Instance reference no longer exists"). macOS needs the first of the
      // three, Linux all of them.
      args: [
        '--enable-precise-memory-info',
        '--js-flags=--expose-gc',
        '--enable-unsafe-webgpu',
        '--use-webgpu-adapter=swiftshader',
        '--use-angle=swiftshader',
        '--enable-features=Vulkan',
        '--use-vulkan=swiftshader',
      ],
    }),
    backendLauncher('chromium', 'WebGL2', {
      // --enable-precise-memory-info: without it, performance.memory.usedJSHeapSize is
      // quantized to a fixed bucket and never moves. --js-flags=--expose-gc: without it,
      // there is no way to force a GC before a heap sample, so samples aren't comparable.
      args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
    }),
    backendLauncher('firefox', 'WebGL2', {
      headless: true,
      firefoxUserPrefs: {
        // Firefox probes the GL driver in a child process (glxtest) at startup and waits at most
        // 4 seconds for it. On a loaded CI runner with cold caches, llvmpipe can miss that window;
        // Firefox then treats GL as blocked for the whole session and every getContext('webgl2')
        // returns null ("AllowWebgl2:false restricts context creation on this system").
        // force-enabled skips that gate and creates the context through the driver directly.
        'webgl.force-enabled': true,
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
