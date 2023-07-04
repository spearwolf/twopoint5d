import {Eventize, Priority} from '@spearwolf/eventize';
import {EntityTwinContext} from './EntityTwinContext';
import {EntitiesSyncEvent} from './types';

export class EntitiesLink extends Eventize {
  static OnSync = Symbol('onSync');

  #namespace: string | symbol;

  get namespace(): string | symbol {
    return this.#namespace;
  }

  get context(): EntityTwinContext {
    return EntityTwinContext.get(this.#namespace);
  }

  #readyPromise: Promise<EntitiesLink>;
  #readyResolve!: (value: EntitiesLink) => void;

  get ready(): Promise<EntitiesLink> {
    return this.#readyPromise;
  }

  #isReady = false;

  get isReady() {
    return this.#isReady;
  }

  #syncCallsBeforeReady = 0;

  constructor(namespace?: string | symbol) {
    super();

    this.#namespace = namespace ?? EntityTwinContext.GlobalNS;

    this.#readyPromise = new Promise<EntitiesLink>((resolve) => {
      this.#readyResolve = resolve;
    });
  }

  sync(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isReady) {
        this.#syncCallsBeforeReady++;
        if (this.#syncCallsBeforeReady > 1) {
          return this.once(EntitiesLink.OnSync, Priority.Low, () => resolve());
        }
      }
      this.ready.then(() => {
        const syncEvent: EntitiesSyncEvent = {
          changeTrail: this.context.buildChangeTrails(),
        };
        this.emit(EntitiesLink.OnSync, syncEvent);
        resolve();
      });
    });
  }

  protected start() {
    this.#isReady = true;
    this.#readyResolve(this);
  }
}
