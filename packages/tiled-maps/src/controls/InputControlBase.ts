export class InputControlBase {
  readonly #listeners: [host: EventTarget, eventName: string, callback: any, passive: boolean][] = [];

  #findListenerIndex = (host: EventTarget, eventName: string, callback: any, passive = true) => {
    return this.#listeners.findIndex(
      (listener) => listener[0] === host && listener[1] === eventName && listener[2] === callback && listener[3] === passive,
    );
  };

  #active = true;

  protected addEventListener(host: EventTarget, eventName: string, callback: any, passive = true) {
    if (this.#findListenerIndex(host, eventName, callback, passive) === -1) {
      this.#listeners.push([host, eventName, callback, passive]);
      if (this.#active) {
        host.addEventListener(eventName, callback, {passive});
      }
    }
  }

  protected removeEventListener(host: EventTarget, eventName: string, callback: any, passive = true) {
    const index = this.#findListenerIndex(host, eventName, callback, passive);
    if (index === -1) {
      if (this.#active) {
        const [host, eventName, callback] = this.#listeners[index];
        host.removeEventListener(eventName, callback);
      }
      this.#listeners.splice(index, 1);
    }
  }

  get isActive() {
    return this.#active && this.#listeners.length > 0;
  }

  set isActive(active: boolean) {
    this.#active = active;
  }

  subscribe() {
    if (!this.#active) {
      this.#listeners.forEach(([host, eventName, callback, passive]) => {
        host.addEventListener(eventName, callback, {passive});
      });
      this.#active = true;
    }
  }

  unsubscribe() {
    this.#listeners.forEach(([host, eventName, callback]) => {
      host.removeEventListener(eventName, callback);
    });
    this.#active = false;
  }

  destroyAllListeners() {
    this.unsubscribe();
    this.#listeners.length = 0;
  }
}
