/** @import {Display} from '@spearwolf/twopoint5d' */

/**
 * Stops a display and resolves once the GPU has run everything submitted to it so far.
 *
 * A teardown calls this right before it disposes a display. On Firefox 155 under WebGPU, a
 * `dispose()` that destroys the device while submitted work is still in flight reports a
 * `GPUInternalError` on the destroyed device, and the page gets no `requestAnimationFrame`
 * callback after that — every later test in the file waits for a frame until it times out.
 * Stopping first keeps the display's own frame loop from submitting more work while the queue
 * drains. Once Firefox takes such a device down without stalling, the calls can go: remove
 * them and run `pnpm test:browser`.
 *
 * @param {Display | undefined} display
 */
export async function stopAndDrain(display) {
  if (!display || display.isDisposed) return;
  display.stop();
  // the WebGL2 backend has no queue to wait for
  if (!display.isWebGPUBackend) return;
  // the three.js typings leave the device off WebGPUBackend
  const {device} = /** @type {{device?: {queue: {onSubmittedWorkDone(): Promise<unknown>}} | null}} */ (display.renderer.backend);
  if (device) await device.queue.onSubmittedWorkDone();
}
