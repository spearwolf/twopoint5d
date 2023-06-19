import {Eventize} from '@spearwolf/eventize';
import {SignalReader, SignalWriter, batch, createSignal, value} from '@spearwolf/signalize';
import {EntityKernel} from './EntityKernel';

export class EntityUplink extends Eventize {
  #kernel: EntityKernel;
  #uuid: string;

  #signals = new Map<string, [get: SignalReader<any>, set: SignalWriter<any>]>();

  get kernel(): EntityKernel {
    return this.#kernel;
  }

  get uuid(): string {
    return this.#uuid;
  }

  constructor(kernel: EntityKernel, uuid: string) {
    super();
    this.#kernel = kernel;
    this.#uuid = uuid;
  }

  getSignal<T = unknown>(key: string): [SignalReader<T>, SignalWriter<T>] {
    if (!this.#signals.has(key)) {
      const signal = createSignal<T>();
      this.#signals.set(key, signal);
      return signal;
    }
    return this.#signals.get(key)!;
  }

  getSignalReader<T = unknown>(key: string): SignalReader<T> {
    return this.getSignal<T>(key)[0];
  }

  getSignalWriter<T = unknown>(key: string): SignalWriter<T> {
    return this.getSignal<T>(key)[1];
  }

  setProperties(properties: [string, unknown][]) {
    batch(() => {
      for (const [key, val] of properties) {
        this.setProperty(key, val);
      }
    });
  }

  setProperty<T = unknown>(key: string, value: T) {
    this.getSignalWriter<T>(key)(value);
  }

  getProperty<T = unknown>(key: string): T {
    return value(this.getSignalReader<T>(key));
  }

  propertyKeys(): string[] {
    return Array.from(this.#signals.keys());
  }

  propertyEntries(): [string, unknown][] {
    return Array.from(this.#signals.entries()).map(([key, [get]]) => [key, value(get)]);
  }
}
