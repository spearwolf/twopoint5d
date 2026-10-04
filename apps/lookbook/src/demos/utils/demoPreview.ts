import type {Display} from '@spearwolf/twopoint5d';
import {EVENT_GENERATE_PREVIEW} from '~components/constants';
import type {LookBookGeneratePreviewEventDetail} from '~components/types';

/**
 * The preview protocol of the lookbook demos. `pnpm lookbook:generate-previews` opens every
 * demo with `?preview=1` and takes its screenshot when the page dispatches
 * EVENT_GENERATE_PREVIEW on the document: DEFAULT_PREVIEW_DELAY_MS after VanillaDemo.astro
 * armed the timer, or when a demo that took over with deferPreview() calls ready().
 *
 * The state lives in this module. VanillaDemo.astro and the script of the page import the
 * same instance, and whichever of the two runs first, a deferPreview() wins over the timer.
 */
export const DEFAULT_PREVIEW_DELAY_MS = 5000;

export interface PreviewHandle {
  /**
   * Dispatches the event after the next rendered frame: with displays, once each of them has
   * rendered its next frame and one more animation frame has passed, so the frame is on the
   * screen; without, after two animation frames. A second call does nothing.
   */
  ready(...displays: Display[]): void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let handle: PreviewHandle | undefined;
let fired = false;

const lateHandle: PreviewHandle = {ready() {}};

function fire(trigger: LookBookGeneratePreviewEventDetail['trigger']): void {
  if (fired) return;
  fired = true;
  // every demo page is served at <base>/demos/<id>/, as DemoNavBar.astro reads it as well
  const demoId = location.pathname.split('/').filter(Boolean).at(-1) ?? '';
  document.dispatchEvent(new CustomEvent(EVENT_GENERATE_PREVIEW, {detail: {demoId, trigger}}));
}

function afterAnimationFrames(count: number, callback: () => void): void {
  if (count <= 0) {
    callback();
    return;
  }
  requestAnimationFrame(() => afterAnimationFrames(count - 1, callback));
}

/** Starts the default delay, unless a demo took over already. VanillaDemo.astro calls it once. */
export function armPreviewTimeout(): void {
  if (handle || fired || timer !== undefined) return;
  timer = setTimeout(() => {
    timer = undefined;
    // a deferPreview() in the two frames still wins
    afterAnimationFrames(2, () => {
      if (!handle) fire('timeout');
    });
  }, DEFAULT_PREVIEW_DELAY_MS);
}

/**
 * Takes the moment of the screenshot over from the default delay. Call it synchronously at
 * the top of the page's script, before its first `await`: once the event is out, the handle
 * it returns does nothing.
 */
export function deferPreview(): PreviewHandle {
  if (handle) return handle;
  if (fired) {
    // biome-ignore lint/suspicious/noConsole: the author of the demo has to see the late call
    console.warn('[lookbook] deferPreview(): the preview event fired already, call deferPreview() before the first await');
    return lateHandle;
  }
  clearTimeout(timer);
  timer = undefined;

  let called = false;
  handle = {
    ready(...displays: Display[]) {
      if (called) return;
      called = true;
      if (displays.length === 0) {
        afterAnimationFrames(2, () => fire('ready'));
        return;
      }
      let pending = displays.length;
      for (const display of displays) {
        const unsubscribe = display.onRenderFrame(() => {
          unsubscribe();
          pending -= 1;
          if (pending === 0) afterAnimationFrames(1, () => fire('ready'));
        });
      }
    },
  };
  return handle;
}
