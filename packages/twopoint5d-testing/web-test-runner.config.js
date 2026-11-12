import path from 'node:path';
import {esbuildPlugin} from '@web/dev-server-esbuild';
import {defaultReporter} from '@web/test-runner';
import {playwrightLauncher} from '@web/test-runner-playwright';

/** @typedef {'WebGPU' | 'WebGL2'} Backend */

/**
 * A Playwright launcher whose pages render under `backend`, named after both — the reporter
 * keys its results and browser logs by that name.
 *
 * @param {'chromium' | 'firefox' | 'webkit'} product
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
      await context.addInitScript(takeExpectedRejections);
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

/**
 * Runs in the page before any of its scripts, like pinBackend(). It leaves
 * `globalThis.twopoint5dExpectRejection(reason)` behind, which `whenRejectionsReported()` in
 * test/helpers/fixtures.js calls: the promise it returns settles once the browser reports `reason`
 * as an unhandled rejection, and that report goes no further. The runner puts a logger of
 * @web/browser-logs into every page, which writes each unhandled rejection into the browser logs
 * as "An error was thrown in a Promise outside a test", whether a listener prevented its default
 * or not. Only a listener added before the logger's keeps a rejection that a test leaves
 * unhandled on purpose out of them, and an init script runs before every script of the page.
 */
function takeExpectedRejections() {
  /** @type {Map<unknown, () => void>} */
  const expected = new Map();
  Object.defineProperty(globalThis, 'twopoint5dExpectRejection', {
    /** @param {unknown} reason */
    value: (reason) =>
      new Promise((resolve) => {
        expected.set(reason, resolve);
      }),
  });
  window.addEventListener('unhandledrejection', (event) => {
    const settle = expected.get(event.reason);
    if (settle === undefined) return;
    expected.delete(event.reason);
    // off the console of the browser
    event.preventDefault();
    // and away from the logger and from every listener a test adds
    event.stopImmediatePropagation();
    settle();
  });
}

/**
 * What three writes once per renderer under every WebGL2 launcher, where the fallback is the
 * point of the run — some two thousand identical lines per run, which bury every other log.
 * renderer-backend.test.js checks the backend itself.
 */
const WEBGL2_FALLBACK_WARNING = 'THREE.WebGPURenderer: WebGPU is not available, running under WebGL2 backend.';

// A file belongs here when none of its tests renders, reads a pixel back or asserts anything about
// the renderer or its backend. A `Display` it builds still initializes its renderer under the
// backend of the launcher (the constructor calls `renderer.init()`), but serves the test as an
// element with a size. Such a file runs once per engine: Chromium under WebGPU — the launcher that
// leaves a page as a user's Chromium has it —, Firefox and WebKit.
const RENDERER_FREE_FILES = [
  'test/display-fullscreen.test.js',
  'test/harness-rejections.test.js',
  'test/pan-control-cursor.test.js',
  'test/pan-control-dispose.test.js',
  'test/pan-control-input.test.js',
  'test/pan-control-keys.test.js',
  'test/pan-control-pointer-target.test.js',
  'test/pan-control-stylesheet-root.test.js',
  'test/pan-control-switch-off.test.js',
  'test/stylesheets.test.js',
  'test/texture-store-on.test.js',
];

// The launchers are built once and shared by name: the runner starts a launcher once however many
// groups list the same object.
const chromiumWebGPU = backendLauncher('chromium', 'WebGPU', {
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
  // --disable-accelerated-2d-canvas: on macOS a 2D canvas still draws on the GPU, and
  // copyExternalImageToTexture() cannot take its texture into a SwiftShader device — every
  // upload of a CanvasTexture fails as "CopyTextureForBrowser from [Invalid Texture]" and the
  // texture stays black. Drawn in software, the canvas copies on every platform.
  args: [
    '--enable-precise-memory-info',
    '--js-flags=--expose-gc',
    '--enable-unsafe-webgpu',
    '--use-webgpu-adapter=swiftshader',
    '--use-angle=swiftshader',
    '--enable-features=Vulkan',
    '--use-vulkan=swiftshader',
    '--disable-accelerated-2d-canvas',
  ],
});

const chromiumWebGL2 = backendLauncher('chromium', 'WebGL2', {
  // --enable-precise-memory-info: without it, performance.memory.usedJSHeapSize is
  // quantized to a fixed bucket and never moves. --js-flags=--expose-gc: without it,
  // there is no way to force a GC before a heap sample, so samples aren't comparable.
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
});

const firefoxWebGL2 = backendLauncher('firefox', 'WebGL2', {
  headless: true,
  firefoxUserPrefs: {
    // Firefox probes the GL driver in a child process (glxtest) at startup and waits at most
    // 4 seconds for it. On a loaded CI runner with cold caches, llvmpipe can miss that window;
    // Firefox then treats GL as blocked for the whole session and every getContext('webgl2')
    // returns null ("AllowWebgl2:false restricts context creation on this system").
    // force-enabled skips that gate and creates the context through the driver directly.
    'webgl.force-enabled': true,
  },
});

// WebKit, the engine of Safari. Playwright 1.63.0 ships WebKit 26.6, whose pages have no
// navigator.gpu (measured on macOS), so it renders under WebGL 2; it needs no flags.
const webkitWebGL2 = backendLauncher('webkit', 'WebGL2', {});

/**
 * The server command `page-screenshot`, which `pageScreenshot()` in test/helpers/fixtures.js sends:
 * a screenshot of the page of the session, or of the `clip` of it in CSS pixels, as a PNG in
 * base64. It is the one way a test reads what the compositor shows: a read of the canvas from the
 * page reads the drawing buffer, which a frame that drew nothing has not presented.
 *
 * @returns {import('@web/test-runner').TestRunnerPlugin}
 */
function pageScreenshotPlugin() {
  return {
    name: 'page-screenshot',
    async executeCommand({command, payload, session}) {
      if (command !== 'page-screenshot') return undefined;
      // every launcher of this config is a Playwright launcher
      const launcher = /** @type {import('@web/test-runner-playwright').PlaywrightLauncher} */ (session.browser);
      const clip = /** @type {{clip?: {x: number, y: number, width: number, height: number}} | undefined} */ (payload)?.clip;
      const png = await launcher.getPage(session.id).screenshot({type: 'png', clip});
      return png.toString('base64');
    },
  };
}

/**
 * Lists every skipped test at the end of a run, by launcher — on CI as well, where the progress
 * report and its count are off — so a test that skips where it ought to run shows in the log of a
 * green run.
 *
 * @returns {import('@web/test-runner').Reporter}
 */
function skippedTestsReporter() {
  /**
   * @param {import('@web/test-runner').TestSuiteResult} suite
   * @param {string[]} trail the file and the suites around `suite`
   * @param {string[]} found
   */
  function collect(suite, trail, found) {
    const here = suite.name ? [...trail, suite.name] : trail;
    for (const test of suite.tests) {
      if (test.skipped === true) found.push([...here, test.name].join(' › '));
    }
    for (const child of suite.suites) collect(child, here, found);
  }

  return {
    stop({sessions}) {
      /** @type {Map<string, string[]>} */
      const byLauncher = new Map();
      for (const session of sessions) {
        const name = session.browser.name;
        const skipped = byLauncher.get(name) ?? [];
        byLauncher.set(name, skipped);
        // undefined when the file did not load
        if (session.testResults === undefined) continue;
        const file = path.relative(process.cwd(), session.testFile);
        const found = [];
        collect(session.testResults, [file], found);
        skipped.push(...found);
      }
      const lines = ['Skipped tests:'];
      for (const [name, skipped] of [...byLauncher].sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`  ${name}: ${skipped.length}`);
        for (const test of skipped.sort()) lines.push(`    ${test}`);
      }
      // biome-ignore lint/suspicious/noConsole: a reporter writes to the log of the run
      console.log(lines.join('\n'));
    },
  };
}

export default {
  nodeResolve: true,
  // in a monorepo you need to set set the root dir to resolve modules
  rootDir: '../../',
  files: ['test/**/*.test.js', ...RENDERER_FREE_FILES.map((file) => `!${file}`)],
  // The progress report is the only sign of life in a run of two minutes and more: under Nx the
  // runner has no terminal of its own and prints it as a static block every 10 seconds. On CI
  // (`CI` is set by GitHub Actions) those blocks would only lengthen the log.
  reporters: [defaultReporter({reportTestResults: true, reportTestProgress: !process.env.CI}), skippedTestsReporter()],
  filterBrowserLogs: ({type, args}) => !(type === 'warn' && args[0] === WEBGL2_FALLBACK_WARNING),
  plugins: [esbuildPlugin({target: 'auto'}), pageScreenshotPlugin()],
  // Every test file that renders runs under all four launchers; the files of RENDERER_FREE_FILES
  // run under three. Which backend a browser would pick on its own depends on the machine —
  // headless Chromium has no WebGPU without a flag, headless Firefox has no adapter at all, and
  // Playwright's WebKit offers no navigator.gpu — so WebKit runs under WebGL 2 alone, and each
  // launcher pins its backend and renderer-backend.test.js fails when three ends up on another one.
  browsers: [chromiumWebGPU, chromiumWebGL2, firefoxWebGL2, webkitWebGL2],
  // the group of the files above runs on its own browsers, the same launcher objects: the runner
  // starts each launcher once, whatever number of groups names it
  groups: [{name: 'renderer-free', files: RENDERER_FREE_FILES, browsers: [chromiumWebGPU, firefoxWebGL2, webkitWebGL2]}],
  testFramework: {
    config: {
      ui: 'bdd',
      // a cold start of the renderer — adapter and device under WebGPU, on CI on SwiftShader —
      // falls into the first hook or the first test of a case, and hooks run on this budget as
      // well. A file that needs more says why beside its own this.timeout()
      timeout: '20000',
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
