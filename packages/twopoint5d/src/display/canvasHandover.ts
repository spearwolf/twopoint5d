import type {WebGPURenderer} from 'three/webgpu';

// A GPU that has not reported the work submitted to it done after this long is not going to;
// the release goes on instead of holding every later display on the canvas. Generous against the
// reason for the wait below, short against a remount — the same as CONTEXT_RESTORE_TIMEOUT_MS
const SUBMITTED_WORK_TIMEOUT_MS = 2000;

// renderer.dispose() destroys the device (WebGPUBackend.dispose()), and WebGPU allows an
// implementation to drop the work still pending on a device that is destroyed
// (GPUDevice.destroy()). So the queue runs dry first, or the device reports itself lost, which
// leaves no work to wait for. The wait ends after SUBMITTED_WORK_TIMEOUT_MS at the latest, with a
// warning: an implementation that never answers must not hold the release forever
async function drainSubmittedWork(renderer: WebGPURenderer): Promise<void> {
  // the three.js typings leave the device off the backend, and the WebGL backend has none
  const device = (
    renderer.backend as {device?: {queue: {onSubmittedWorkDone(): Promise<unknown>}; lost?: Promise<unknown>} | null} | undefined
  )?.device;
  if (device == null) return;

  const drained = (async () => {
    try {
      await device.queue.onSubmittedWorkDone();
    } catch {
      // a device that is already lost has no work left to wait for; the release goes on anyway
    }
    return false;
  })();
  // a device without the promise has one way less to end the wait
  const lost = device.lost?.then(
    () => false,
    () => false,
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), SUBMITTED_WORK_TIMEOUT_MS);
  });

  try {
    if (await Promise.race(lost != null ? [drained, lost, timedOut] : [drained, timedOut])) {
      // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
      console.warn(
        `Display#dispose(): the GPU did not report the work submitted to it done within ${SUBMITTED_WORK_TIMEOUT_MS} ms; the renderer is released anyway`,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

// A visible page that has not drawn two frames after this long is not going to; the release goes
// on. The same as SUBMITTED_WORK_TIMEOUT_MS. A hidden page does not end the wait: it presents the
// canvas once it is visible again, and the device has to live until then
const ANIMATION_FRAMES_TIMEOUT_MS = 2000;

// On Firefox 155 under WebGPU, a renderer.dispose() on a canvas that is still in the document,
// before the page has presented what was drawn into it last, reports a GPUInternalError (`Buffer
// with '' label has been destroyed`), and the page gets no requestAnimationFrame callback after
// that — every animation on the page stands still. Whether the queue has run dry makes no
// difference; a canvas outside the document is not affected. A canvas handed to the constructor
// and the canvas of an adopted renderer stay where their caller put them, and the canvas of a
// container the display built leaves the document with that container but can be put into one
// again while the release runs. So the release waits for two animation frames of the page,
// whatever the canvas: the callbacks of the first run before the page presents the frame the
// canvas was drawn into last (the "update the rendering" steps of HTML run them before
// painting), those of the second after it. Under WebGL, and for a canvas without a window,
// there is nothing to wait for
async function waitForTwoAnimationFrames(renderer: WebGPURenderer): Promise<void> {
  // the three.js typings leave the device off the backend, and the WebGL backend has none
  const device = (renderer.backend as {device?: object | null} | undefined)?.device;
  // the window of the document the canvas sits in, which presents it — an iframe has its own
  const view = renderer.domElement.ownerDocument?.defaultView;
  if (device == null || view == null) return;

  const doc = view.document as Document | undefined;
  for (;;) {
    if (doc?.hidden) await untilVisible(doc);
    if (await twoAnimationFrames(view)) return;
    // no two frames within the wait: a page hidden meanwhile waits to be visible and tries again,
    // a visible page that draws nothing lets the release go on
    if (!doc?.hidden) return;
  }
}

function untilVisible(doc: Document): Promise<void> {
  return new Promise<void>((resolve) => {
    const onVisibilityChange = () => {
      if (doc.hidden) return;
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      resolve();
    };
    doc.addEventListener('visibilitychange', onVisibilityChange);
  });
}

// true once the page has drawn two frames, false after ANIMATION_FRAMES_TIMEOUT_MS without them
function twoAnimationFrames(view: Window): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let request = 0;
    const timer = setTimeout(() => {
      view.cancelAnimationFrame(request);
      resolve(false);
    }, ANIMATION_FRAMES_TIMEOUT_MS);
    // the second frame is requested inside the callback of the first: two requests in the same
    // tick would come in the same frame
    request = view.requestAnimationFrame(() => {
      request = view.requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  });
}

// WebGLBackend.init() puts a webglcontextlost listener on the canvas before the part of it that
// can fail. renderer.dispose() would take it off, but releases only a renderer whose init went
// through, and three makes the listener reachable only through this field, private by convention
function dropContextLostListener(renderer: WebGPURenderer): void {
  // the three.js typings leave the field off the backend
  const backend = renderer.backend as {isWebGLBackend?: boolean; _onContextLost?: EventListener} | undefined;
  if (backend?.isWebGLBackend && backend._onContextLost != null) {
    renderer.domElement.removeEventListener('webglcontextlost', backend._onContextLost);
  }
}

// A WebGL context the browser has not brought back after this long is not coming back for the
// display waiting for the canvas, and that display starts on it anyway: a failed init reaches its
// caller through start() and the error event, a wait without end reaches nobody
const CONTEXT_RESTORE_TIMEOUT_MS = 2000;

// The WebGL context a release has lost on a canvas handed to a display, kept restorable. The
// context stays lost until a display is built on the canvas: a live context that nobody draws
// to counts against the few the browser keeps alive, and it drops the oldest one — possibly
// that of a running display — once there are too many
interface LostContext {
  gl: WebGL2RenderingContext;
  extension: WEBGL_lose_context;
  // settles once the webglcontextlost event has had its default prevented; before that the
  // browser turns down a restoreContext()
  prevented: Promise<void>;
  // the restore a display built on the canvas has started, so a display built while it runs
  // waits for the same one; cleared once it has ended with the context still lost
  restoring?: Promise<void>;
}

// The release of a renderer runs on after dispose() has returned, and the canvas handed to
// that display is not free before the release is through: a renderer initialized on it in
// the meantime would share the WebGL context of the one being released and lose it with it.
// The entry settles once the release is through, never rejects, and goes with it. A WeakMap,
// like lostContexts below, so an entry does not hold on to a canvas its caller has let go
const canvasReleases = new WeakMap<HTMLCanvasElement, Promise<void>>();

// The context a release has lost on a canvas handed to a display, for as long as it stays
// lost: however long no display comes, and past a restore that ran out of time, so every
// display built on the canvas tries once more. The display that brings it back takes the
// entry out. In one case the entry outlasts the loss: a context the browser brings back only
// after the wait has run out stays here, alive, until the next display built on the canvas
// finds it alive — restoreContext() answers at once then — and takes the entry out. That is
// harmless, and a listener for webglcontextrestored kept on the caller's canvas to clear it
// would be exactly the kind of leftover a release must not leave behind
const lostContexts = new WeakMap<HTMLCanvasElement, LostContext>();

// A canvas keeps its one WebGL context for good and answers every later getContext('webgl2')
// with it, and WebGLBackend.dispose() gives that context up with WEBGL_lose_context.loseContext().
// A context whose loss has its default prevented can be restored later, so the release of a
// canvas that goes back to its caller prevents it and hands the context on to the next display
async function disposeKeepingContextRestorable(renderer: WebGPURenderer): Promise<LostContext | undefined> {
  // the three.js typings leave gl off the backend, and the WebGPU backend has none
  const backend = renderer.backend as {isWebGLBackend?: boolean; gl?: WebGL2RenderingContext | null} | undefined;
  const gl = backend?.isWebGLBackend ? backend.gl : undefined;
  // fetched before renderer.dispose(): a lost context answers getExtension() with null. Without
  // the extension three calls no loseContext(), and there is nothing to restore
  const extension = gl != null && !gl.isContextLost() ? gl.getExtension('WEBGL_lose_context') : null;
  if (gl == null || extension == null) {
    await renderer.dispose();
    return undefined;
  }

  const canvas = renderer.domElement;
  let markPrevented!: () => void;
  const prevented = new Promise<void>((resolve) => {
    markPrevented = resolve;
  });
  const onContextLost = (event: Event) => {
    // only a loss whose default was prevented may be restored
    event.preventDefault();
    markPrevented();
  };
  // once: the listener is meant for the loss renderer.dispose() causes and for no later one
  canvas.addEventListener('webglcontextlost', onContextLost, {once: true});
  try {
    // awaited: WebGLBackend.dispose() calls loseContext() only after an await of its own, so the
    // context is not lost yet when the call returns
    await renderer.dispose();
  } catch (error) {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    throw error;
  }
  if (!gl.isContextLost()) {
    // no loss, no event, and nothing to restore
    canvas.removeEventListener('webglcontextlost', onContextLost);
    return undefined;
  }
  return {gl, extension, prevented};
}

// Restores the context a release has lost on the canvas, for a display that is about to be
// built on it. Settles once the context is back, or after CONTEXT_RESTORE_TIMEOUT_MS
function restoreContext(canvas: HTMLCanvasElement, lost: LostContext): Promise<void> {
  if (!lost.gl.isContextLost()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let waiting = true;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;

    const endWait = () => {
      if (!waiting) return;
      waiting = false;
      canvas.removeEventListener('webglcontextrestored', endWait);
      clearTimeout(timeout);
      clearTimeout(restoreTimer);
      resolve();
    };

    const timeout = setTimeout(() => {
      endWait();
      // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
      console.warn(
        `new Display(): the WebGL context of the canvas did not come back within ${CONTEXT_RESTORE_TIMEOUT_MS} ms; the display starts on it anyway`,
      );
    }, CONTEXT_RESTORE_TIMEOUT_MS);

    canvas.addEventListener('webglcontextrestored', endWait);

    void lost.prevented.then(() => {
      if (!waiting) return;
      // the browser decides whether the context may come back only after the webglcontextlost
      // event has been dispatched; a restoreContext() inside its handler is turned down
      restoreTimer = setTimeout(() => {
        if (waiting) lost.extension.restoreContext();
      }, 0);
    });
  });
}

// What a display built on a canvas waits for before the init of its renderer starts: the release
// of the display on that canvas before it, while one runs, and the context a release has lost on
// the canvas coming back
async function takeOverCanvas(canvas: HTMLCanvasElement, release: Promise<void> | undefined): Promise<void> {
  await release;
  const lost = lostContexts.get(canvas);
  if (lost == null) return;

  lost.restoring ??= restoreContext(canvas, lost);
  const restoring = lost.restoring;
  await restoring;

  if (!lost.gl.isContextLost()) {
    // only this entry goes: one the release of a later display has made in the meantime stays
    if (lostContexts.get(canvas) === lost) lostContexts.delete(canvas);
  } else if (lost.restoring === restoring) {
    // the wait has run out and the entry stays, so the next display built on the canvas tries
    // the restore again
    lost.restoring = undefined;
  }
}

// What a display writes on a canvas handed to its constructor, as it was before, so
// dispose() can give the canvas back as the display found it
interface CanvasState {
  // null where the attribute was absent. data-engine is the mark three puts on the canvas of
  // its renderer
  attributes: Record<CanvasStateAttribute, string | null>;
  style: Record<CanvasStateStyleProperty, {value: string; priority: string}>;
}

type CanvasStateAttribute = 'class' | 'style' | 'touch-action' | 'width' | 'height' | 'data-engine';
type CanvasStateStyleProperty = 'width' | 'height' | 'image-rendering';

const CANVAS_STATE_ATTRIBUTES: readonly CanvasStateAttribute[] = [
  'class',
  'style',
  'touch-action',
  'width',
  'height',
  'data-engine',
];
const CANVAS_STATE_STYLE_PROPERTIES: readonly CanvasStateStyleProperty[] = ['width', 'height', 'image-rendering'];

export function readCanvasState(canvas: HTMLCanvasElement): CanvasState {
  const attributes = {} as CanvasState['attributes'];
  for (const name of CANVAS_STATE_ATTRIBUTES) {
    attributes[name] = canvas.getAttribute(name);
  }
  const style = {} as CanvasState['style'];
  for (const property of CANVAS_STATE_STYLE_PROPERTIES) {
    style[property] = {value: canvas.style.getPropertyValue(property), priority: canvas.style.getPropertyPriority(property)};
  }
  return {attributes, style};
}

// classNames are the classes the display has handed out; a class the caller has set in the
// meantime stays
export function restoreCanvasState(canvas: HTMLCanvasElement, state: CanvasState, classNames: readonly string[]): void {
  canvas.classList.remove(...classNames);

  for (const property of CANVAS_STATE_STYLE_PROPERTIES) {
    const {value, priority} = state.style[property];
    if (value === '') {
      canvas.style.removeProperty(property);
    } else {
      canvas.style.setProperty(property, value, priority);
    }
  }

  // class and style go back through the classes and properties above, not as a whole
  for (const name of CANVAS_STATE_ATTRIBUTES) {
    if (name === 'class' || name === 'style') continue;
    const value = state.attributes[name];
    if (value == null) {
      canvas.removeAttribute(name);
    } else {
      canvas.setAttribute(name, value);
    }
  }

  // a bare <canvas> goes back as <canvas></canvas>, without the empty attributes left behind
  if (state.attributes.class == null && canvas.classList.length === 0) canvas.removeAttribute('class');
  if (state.attributes.style == null && canvas.style.length === 0) {
    // Chromium writes a change of the inline style into the attribute only once the attribute is
    // read, and a removeAttribute() before that read comes back as style="" at the next one
    canvas.getAttribute('style');
    canvas.removeAttribute('style');
  }
}

export type {CanvasState};

/**
 * What a display on this canvas waits for before the init of its renderer: the release of the
 * display before it, and the context a release has lost on the canvas. `undefined` for a free
 * canvas, so that the init starts in the constructor, synchronously — a `Promise.resolve()` here
 * would start it a microtask later.
 */
export function waitForCanvas(canvas: HTMLCanvasElement): Promise<void> | undefined {
  const release = canvasReleases.get(canvas);
  if (release == null && !lostContexts.has(canvas)) return undefined;
  return takeOverCanvas(canvas, release);
}

/**
 * Releases the renderer of a disposed display, after its init and after dispose() has returned.
 * The entry in canvasReleases stands before the function returns, so a display built on the
 * canvas in the same tick waits for this release.
 *
 * dispose() can fall in the middle of the init (a mount and unmount under React StrictMode).
 * three does not release a renderer whose init is still running: the init would run to its
 * end and keep the device, the context and the animation loop of three for good. So the
 * release waits for the init, then for the GPU, and under WebGPU for two animation frames of
 * the page — see waitForTwoAnimationFrames(). A canvas handed to the constructor goes back to
 * its caller at the end of it, with its WebGL context lost but restorable, so the next display
 * on it can bring the context back
 */
export function releaseRenderer(renderer: WebGPURenderer, {init, handBack}: {init: Promise<unknown>; handBack: boolean}): void {
  const canvas = renderer.domElement;
  const released: Promise<void> = init
    .then(
      async () => {
        await drainSubmittedWork(renderer);
        await waitForTwoAnimationFrames(renderer);
        if (!handBack) {
          await renderer.dispose();
          return;
        }
        const lost = await disposeKeepingContextRestorable(renderer);
        // set before the release settles, so a display that waits for the release finds it
        if (lost != null) lostContexts.set(canvas, lost);
      },
      () => {
        // a failed init has built nothing that renderer.dispose() would release but the
        // webglcontextlost listener three put on the canvas before it failed, and that listener
        // goes here. renderer.dispose() itself stays uncalled: its setAnimationLoop(null) would
        // wait on the rejected init once more — a rejection that nobody could catch
        dropContextLostListener(renderer);
      },
    )
    .catch((error: unknown) => {
      // biome-ignore lint/suspicious/noConsole: no caller is left to hand the error to
      console.error('Display#dispose(): releasing the renderer failed after dispose() returned', error);
    });

  if (handBack) {
    // set before dispose() returns, so a display built on the canvas in the same tick sees it
    canvasReleases.set(canvas, released);
    void released.then(() => {
      // only this entry goes: one a display after this one has made in the meantime stays
      if (canvasReleases.get(canvas) === released) canvasReleases.delete(canvas);
    });
  }
}
