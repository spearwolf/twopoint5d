import {expectDefined} from '../utils/expectDefined.js';

export class InputControlBase {
  readonly #listeners: [host: EventTarget, eventName: string, callback: any, passive: boolean][] = [];

  #findListenerIndex = (host: EventTarget, eventName: string, callback: any, passive = true) => {
    return this.#listeners.findIndex(
      (listener) => listener[0] === host && listener[1] === eventName && listener[2] === callback && listener[3] === passive,
    );
  };

  #active = true;

  protected addEventListener(host: EventTarget, eventName: string, callback: any, passive = true) {
    // a disposed control takes no new listener. Without this, the public setters of a
    // subclass would refill the list on an instance that is out of service, and the closures
    // and host references in it would stay reachable for as long as anybody holds the control
    if (this.#disposed) return;

    if (this.#findListenerIndex(host, eventName, callback, passive) === -1) {
      this.#listeners.push([host, eventName, callback, passive]);
      if (this.#active) {
        host.addEventListener(eventName, callback, {passive});
      }
    }
  }

  protected removeEventListener(host: EventTarget, eventName: string, callback: any, passive = true) {
    const index = this.#findListenerIndex(host, eventName, callback, passive);
    if (index >= 0) {
      if (this.#active) {
        const [host, eventName, callback] = expectDefined(this.#listeners[index], `the listener at index ${index}`);
        host.removeEventListener(eventName, callback);
      }
      this.#listeners.splice(index, 1);
    }
  }

  /**
   * `true` while this control has listeners and they are hooked up to their hosts.
   *
   * A disposed control has none of either, so this is `false` from {@link dispose} on.
   */
  get isActive() {
    return this.#active && this.#listeners.length > 0;
  }

  /**
   * Writing `true` runs {@link subscribe}, writing `false` runs {@link unsubscribe}.
   *
   * On a disposed control a write of `true` does nothing, and reading gives `false` back.
   */
  set isActive(active: boolean) {
    if (!this.#active && active) {
      this.subscribe();
    } else if (this.#active && !active) {
      this.unsubscribe();
    }
  }

  /**
   * Hook every listener of this control up to its host.
   *
   * On a disposed control this does nothing: there is no listener left, and none can be
   * added any more.
   */
  subscribe() {
    if (this.#disposed) return;

    if (!this.#active) {
      this.#listeners.forEach(([host, eventName, callback, passive]) => {
        host.addEventListener(eventName, callback, {passive});
      });
      this.#active = true;
    }
  }

  /**
   * Take every listener of this control off its host, keeping the list so that a
   * {@link subscribe} can hook them up again.
   *
   * On a disposed control this does nothing: the list is empty, and `isActive` is already
   * `false`.
   */
  unsubscribe() {
    this.#listeners.forEach(([host, eventName, callback]) => {
      host.removeEventListener(eventName, callback);
    });
    this.#active = false;
  }

  #disposed = false;

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Take every listener off its host and empty the list.
   *
   * This is a reset, not an end: the control goes on taking listeners afterwards, and a
   * {@link subscribe} hooks up whatever it has taken since. {@link dispose} is the one that
   * ends it.
   *
   * On a disposed control this does nothing — there is no listener left to take off.
   */
  destroyAllListeners() {
    this.unsubscribe();
    this.#listeners.length = 0;
  }

  /**
   * Take every listener off its host and put this control out of service.
   *
   * Every host was handed in and stays the caller's: this call removes only what this
   * control put on it and touches nothing else.
   *
   * Afterwards `isDisposed` is `true`, `isActive` is `false`, and the control cannot be
   * brought back — {@link subscribe}, a write of `true` to {@link isActive} and every
   * `addEventListener()` of a subclass do nothing, so no listener reaches a host again.
   * {@link unsubscribe}, {@link destroyAllListeners} and a further `dispose()` do nothing
   * either.
   *
   * {@link destroyAllListeners} is the other way to empty the list, and it is not this one:
   * a control that has been through it takes listeners again, and a {@link subscribe} hooks
   * them up.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.destroyAllListeners();
  }
}
