// The holder of a `StageRenderer` — a host whose frame and resize it subscribes to, or a parent
// renderer that drives it — and the subscriptions at a host, together with the size a host hands
// in as the renderer subscribes. The events of a move (`OnRemoveFromParent`, `OnAddToParent`) are
// the renderer's own to send. This module is not in `public-api.ts`: only `StageRenderer.ts`
// reaches it.

import type {IStageRendererHost, StageRendererHostUnsubscribe} from './IStageRendererHost.js';
import type {StageRenderer, StageRendererParentType} from './StageRenderer.js';

/** @internal */
export class StageRendererHostLink {
  readonly #owner: StageRenderer;

  #holder?: StageRendererParentType;

  // the subscriptions #addToHost() took at the host that drives the renderer. When the
  // host refuses one of them, #addToHost() gives back at once what the host handed out;
  // otherwise leave(), called by StageRenderer#removeFromParent(), gives them up before
  // OnRemoveFromParent goes out, and no listener of OnRemoveFromParent does: a listener that
  // disposes the renderer takes every listener with it that the event has not reached yet
  #hostSubscriptions: StageRendererHostUnsubscribe[] = [];

  constructor(owner: StageRenderer) {
    this.#owner = owner;
  }

  /** The host or the `StageRenderer` that holds the renderer, `undefined` for none. */
  get holder(): StageRendererParentType | undefined {
    return this.#holder;
  }

  /**
   * Makes `host` the holder and subscribes to its resize and frame; answers whether the host took
   * both subscriptions. What the host or a stage that refuses its size throws goes into `errors`.
   */
  joinHost(host: IStageRendererHost, errors: unknown[]): boolean {
    this.#holder = host;
    if (this.#addToHost(host, errors)) return true;
    // a host that refused a subscription does not hold this renderer
    this.#holder = undefined;
    return false;
  }

  /** Makes `parent` the holder: a parent renderer drives its child from its own frame, and nothing is subscribed. */
  joinRenderer(parent: StageRenderer): void {
    this.#holder = parent;
  }

  /**
   * Lets go of the holder and gives up every subscription at a host; answers the holder that was
   * let go of, `undefined` for none. What an unsubscribe throws goes into `errors`.
   */
  leave(errors: unknown[]): StageRendererParentType | undefined {
    const holder = this.#holder;
    if (holder == null) return undefined;

    // cleared before the event goes out and before the parent hears about it: a remove()
    // coming back in from the other side finds nothing left to detach
    this.#holder = undefined;

    // the host lets go before anyone hears of the move, so a listener that disposes this
    // renderer or gives it another holder finds it off the old host already
    this.#unsubscribeFromHost(errors);

    return holder;
  }

  // gives up every subscription booked at the host. Each handle is asked on its own,
  // and what one throws waits for the caller like the error of a listener
  #unsubscribeFromHost(errors: unknown[]): void {
    const hostSubscriptions = this.#hostSubscriptions;
    this.#hostSubscriptions = [];
    for (const unsubscribe of hostSubscriptions) {
      try {
        unsubscribe();
      } catch (error) {
        errors.push(error);
      }
    }
  }

  // each handle is booked as soon as the host hands it out. A host that throws on
  // either subscription gets back what it handed out and holds nothing of this
  // renderer; its error waits for the caller, and so does the error of a stage that refuses
  // the size the host handed in while it subscribed. Answers whether the host took both
  #addToHost(host: IStageRendererHost, errors: unknown[]): boolean {
    // plain locals, no object: nothing is allocated per resize of the host
    let joining = true;
    let replayed = false;
    let replayedWidth = 0;
    let replayedHeight = 0;
    let replayedPixelRatio = 1;
    try {
      // a host that hands its last size to a new subscriber — a Display retains its resize event —
      // hands it in during onResize(), and eventize catches what a listener throws there. Held
      // until both subscriptions are booked, the size reaches resize() outside of the subscription:
      // a stage that refuses it reaches the caller, and a listener of this resize that disposes the
      // renderer or attaches it elsewhere finds every subscription booked
      this.#hostSubscriptions.push(
        host.onResize(({width, height, pixelRatio}) => {
          if (joining) {
            replayed = true;
            replayedWidth = width;
            replayedHeight = height;
            replayedPixelRatio = pixelRatio;
            return;
          }
          this.#owner.resize(width, height, pixelRatio);
        }),
      );
      this.#hostSubscriptions.push(
        host.onRenderFrame(({renderer, now, deltaTime, frameNo}) => {
          this.#owner.updateFrame(now, deltaTime, frameNo);
          this.#owner.renderTo(renderer);
        }),
      );
    } catch (error) {
      // the size a host handed in goes with the handles: the renderer holds nothing of that host
      errors.push(error);
      this.#unsubscribeFromHost(errors);
      return false;
    } finally {
      joining = false;
    }
    if (replayed) {
      try {
        this.#owner.resize(replayedWidth, replayedHeight, replayedPixelRatio);
      } catch (error) {
        errors.push(error);
      }
    }
    return true;
  }
}
