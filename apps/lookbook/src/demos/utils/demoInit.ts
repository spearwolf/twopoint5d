import type {Display, DisplayEventProps} from '@spearwolf/twopoint5d';

/**
 * Calls `init` as the `onInit` listener of `display` and shows a failure of it. A `Display` emits
 * `OnDisplayInit` and does not wait for the promise of an async listener, so a rejection — an asset
 * that answered 404, a broken JSON — would reach nobody: the canvas stays in its clear color and
 * the GUI never appears. Here it is logged under the name of the demo and written over the canvas.
 * Under `?preview=1` the line over the canvas is hidden; the preview generator prints the console
 * line with its timeout instead. A demo whose init `display.start()` awaits goes through
 * {@link startDemo} instead.
 *
 * @param demo the name of the demo, its route, for the console and the line over the canvas
 * @returns what `display.onInit()` answers
 */
export function onDemoInit(display: Display, demo: string, init: (props: DisplayEventProps) => Promise<void>): () => void {
  return display.onInit(guardInit(demo, init));
}

/**
 * Starts `display` with `init` as the callback that `start()` awaits before the first frame,
 * and shows a failure of it as {@link onDemoInit} does: logged under the name of the demo and
 * written over the canvas. The rejection of `start()` would name no demo and write no line.
 * After a failed init the display starts all the same, as it does beside a failed
 * `onDemoInit()`.
 *
 * @param demo the name of the demo, its route, for the console and the line over the canvas
 * @returns what `display.start()` answers; it still rejects where `start()` fails on its own —
 *   a display disposed while `init` ran, a renderer that does not come up
 */
export function startDemo(display: Display, demo: string, init: (props: DisplayEventProps) => Promise<void>): Promise<Display> {
  return display.start(guardInit(demo, init));
}

function guardInit(demo: string, init: (props: DisplayEventProps) => Promise<void>): (props: DisplayEventProps) => Promise<void> {
  return async (props: DisplayEventProps) => {
    try {
      await init(props);
    } catch (error) {
      showDemoFailure(demo, error);
    }
  };
}

function showDemoFailure(demo: string, error: unknown): void {
  // biome-ignore lint/suspicious/noConsole: a demo that fails to start names the error in the devtools, beside the line over its canvas
  console.error(`${demo}: the demo failed to start`, error);
  const line = document.createElement('p');
  line.className = 'demo-failure';
  line.setAttribute('role', 'alert');
  line.textContent = `${demo} failed to start: ${error instanceof Error ? error.message : String(error)}. The console has the details.`;
  // not getDemoUi(): a page without <demo-ui> would throw here and bring the rejection back
  (document.querySelector('demo-ui') ?? document.body).append(line);
}

/**
 * Catches a failed `director.precompile()`: it is worth a line in the console under the name of the
 * demo, but the page goes on, and the shaders build on first use instead. The answer resolves
 * either way, so a page can await it before it calls `preview.ready()`.
 */
export function catchPrecompile(demo: string, precompile: Promise<void>): Promise<void> {
  return precompile.catch((error: unknown) => {
    // biome-ignore lint/suspicious/noConsole: a failed precompile() is worth a line in the devtools, the page goes on
    console.error(`${demo}: precompile() failed, the shaders build on first use`, error);
  });
}
