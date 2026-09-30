export const FULLSCREEN_CANVAS_ID = 'canvas-container';

/**
 * The `<canvas>` that `VanillaDemo.astro` writes for a page that sets `fullscreenCanvas`.
 * It fills the window and resizes with it.
 */
export function getFullscreenCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById(FULLSCREEN_CANVAS_ID);
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(
      `[lookbook] getFullscreenCanvas(): the page has no #${FULLSCREEN_CANVAS_ID} canvas, VanillaDemo.astro writes it for a page that sets fullscreenCanvas`,
    );
  }
  return canvas;
}
