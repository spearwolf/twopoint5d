// `pnpm lookbook:generate-previews`: opens every lookbook demo with ?preview=1 in Chromium,
// waits for the demo's EVENT_GENERATE_PREVIEW and writes a screenshot of it as
// apps/lookbook/public/images/demo-preview/<id>.webp. See the "Preview images" section of
// apps/lookbook/README.md.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {
  CHROMIUM_GPU_ARGS,
  EVENT_GENERATE_PREVIEW,
  PREVIEW_HEIGHT,
  PREVIEW_QUALITY,
  PREVIEW_WIDTH,
  parsePreviewArgs,
  selectDemos,
} from './demoPreviewConfig.mjs';
import {listLookbookDemos, previewDir} from './lookbookDemos.mjs';
import {startPreviewServer} from './previewServer.mjs';
import {webpSize} from './webpSize.mjs';

/** @typedef {{id: string, ok: boolean, trigger?: string, seconds: number, kilobytes?: number, problems: string[]}} DemoResult */

/**
 * @param {import('playwright').BrowserContext} context
 * @param {string} baseUrl
 * @returns {Promise<string | undefined>} the adapter, or undefined when three.js falls back to WebGL 2
 */
async function describeWebGpuAdapter(context, baseUrl) {
  const page = await context.newPage();
  try {
    // a page of the lookbook: WebGPU is only there in a secure context, which localhost is
    await page.goto(`${baseUrl}/`);
    return await page.evaluate(async () => {
      const adapter = await /** @type {any} */ (navigator).gpu?.requestAdapter();
      return adapter ? `${adapter.info.vendor} ${adapter.info.architecture}`.trim() : undefined;
    });
  } finally {
    await page.close();
  }
}

/**
 * @param {import('playwright').BrowserContext} context
 * @param {string} baseUrl
 * @param {string} id
 * @param {number} timeoutMs
 * @returns {Promise<DemoResult>}
 */
async function captureDemo(context, baseUrl, id, timeoutMs) {
  const started = performance.now();
  const seconds = () => (performance.now() - started) / 1000;
  /** @type {string[]} */
  const problems = [];
  const target = path.join(previewDir, `${id}.webp`);
  const temporary = `${target}.tmp`;
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });

  try {
    // installed before any script of the page runs, so not even an early event goes unheard
    await page.addInitScript((eventName) => {
      document.addEventListener(eventName, (event) => {
        const w = /** @type {any} */ (window);
        w.__lookbookPreview ??= /** @type {CustomEvent} */ (event).detail;
      });
    }, EVENT_GENERATE_PREVIEW);

    await page.goto(`${baseUrl}/demos/${id}/?preview=1`, {waitUntil: 'load', timeout: timeoutMs});
    const detail = await (
      await page.waitForFunction(() => /** @type {any} */ (window).__lookbookPreview, null, {timeout: timeoutMs})
    ).jsonValue();

    // page.screenshot() knows PNG and JPEG only; the DevTools protocol of Chromium writes WebP
    const cdp = await context.newCDPSession(page);
    const {data} = await cdp.send('Page.captureScreenshot', {format: 'webp', quality: PREVIEW_QUALITY});
    const bytes = Buffer.from(data, 'base64');
    const {width, height} = webpSize(bytes);
    if (width !== PREVIEW_WIDTH || height !== PREVIEW_HEIGHT) {
      throw new Error(`the screenshot is ${width}×${height}, not ${PREVIEW_WIDTH}×${PREVIEW_HEIGHT}`);
    }

    fs.writeFileSync(temporary, bytes);
    fs.renameSync(temporary, target);
    return {id, ok: true, trigger: detail?.trigger, seconds: seconds(), kilobytes: bytes.length / 1024, problems};
  } catch (error) {
    fs.rmSync(temporary, {force: true});
    // the first line: Playwright appends its call log to a timeout
    const message = (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';
    return {id, ok: false, seconds: seconds(), problems: [...problems, message]};
  } finally {
    await page.close();
  }
}

/** @param {DemoResult} result */
function printResult({id, ok, trigger, seconds, kilobytes, problems}) {
  const columns = [
    id.padEnd(36),
    (ok ? 'ok' : 'FAILED').padEnd(7),
    (trigger ?? '-').padEnd(8),
    `${seconds.toFixed(1)} s`.padStart(7),
    kilobytes === undefined ? '' : `${Math.round(kilobytes)} KB`.padStart(8),
  ];
  console.log(columns.join(' '));
  for (const problem of problems) console.log(`    ${problem}`);
}

async function main() {
  const options = parsePreviewArgs(process.argv.slice(2));
  const ids = selectDemos(
    listLookbookDemos().map(({id}) => id),
    options.only,
  );

  /** @type {{baseUrl: string, stop: () => void} | undefined} */
  let server;
  /** @type {import('playwright').Browser | undefined} */
  let browser;
  const onSignal = (/** @type {NodeJS.Signals} */ signal) => {
    server?.stop();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    server = options.url ? undefined : await startPreviewServer();
    const baseUrl = options.url ?? /** @type {{baseUrl: string}} */ (server).baseUrl;

    browser = await chromium.launch({headless: !options.headed, args: CHROMIUM_GPU_ARGS});
    const context = await browser.newContext({
      viewport: {width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT},
      deviceScaleFactor: 1,
    });

    const adapter = await describeWebGpuAdapter(context, baseUrl);
    console.log(`lookbook at ${baseUrl}`);
    console.log(`WebGPU adapter: ${adapter ?? 'none, three.js renders with WebGL 2'}`);
    console.log(`${ids.length} demo(s) into ${path.relative(process.cwd(), previewDir)}\n`);

    /** @type {DemoResult[]} */
    const results = [];
    for (const id of ids) {
      const result = await captureDemo(context, baseUrl, id, options.timeoutMs);
      printResult(result);
      results.push(result);
    }

    const failed = results.filter(({ok}) => !ok).map(({id}) => id);
    console.log(
      failed.length === 0
        ? `\n${results.length} preview(s) written`
        : `\n${failed.length} of ${results.length} failed, their old images stay: ${failed.join(', ')}`,
    );
    return failed.length === 0 ? 0 : 1;
  } finally {
    await browser?.close();
    server?.stop();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(`generateDemoPreviews: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  },
);
