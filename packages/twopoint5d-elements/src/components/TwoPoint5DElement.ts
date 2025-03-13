import {ContextProvider} from '@lit/context';
import {LitElement} from 'lit';
import {property} from 'lit/decorators.js';
import {createEffect, findObjectSignalByName, Signal, SignalGroup} from '@spearwolf/signalize';
import {ConsoleLogger} from '../utils/ConsoleLogger.js';
import {asBoolean} from '../utils/asBoolean.js';
import {readBooleanAttribute} from '../utils/readBooleanAttribute.js';

const DEBUG_ATTR = 'debug';
const UNNAMED = '(unnamed)';

export class TwoPoint5DElement extends LitElement {
  #debug: boolean;

  get debug(): boolean {
    return this.#debug;
  }

  @property({type: Boolean, attribute: DEBUG_ATTR})
  set debug(value: any) {
    this.#debug = asBoolean(value);
    if (!this.#debug && this.#logger != null) {
      this.#logger = undefined;
    }
  }

  #logger?: ConsoleLogger;

  get logger(): ConsoleLogger | undefined {
    if (this.#logger != null) return this.#logger;
    if (this.#debug) {
      this.#logger = ConsoleLogger.getLogger(this.#loggerNS);
    }
    return this.#logger;
  }

  #loggerNS: string;

  get loggerNS(): string {
    return this.#loggerNS;
  }

  set loggerNS(value: string) {
    this.#loggerNS = String(value).trim() || UNNAMED;
    if (this.logger != null && this.logger.namespace !== this.#loggerNS) {
      this.#logger = undefined;
    }
  }

  #signalGroup?: SignalGroup;

  constructor() {
    super();
    this.#loggerNS = UNNAMED;
    this.#debug = readBooleanAttribute(this, DEBUG_ATTR);
  }

  override disconnectedCallback() {
    this.destroySignalGroup();
  }

  protected get signalGroup(): SignalGroup {
    if (this.#signalGroup == null) {
      this.#signalGroup = SignalGroup.findOrCreate(this);
    }
    return this.#signalGroup;
  }

  protected destroySignalGroup() {
    if (this.#signalGroup != null) {
      this.#signalGroup.destroy();
      this.#signalGroup = undefined;
    }
  }

  protected createEffect(fn: () => void, signals: (keyof this)[]) {
    return createEffect(fn, this.signals(...signals), {attach: this.signalGroup});
  }

  override attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === DEBUG_ATTR) {
      this.debug = readBooleanAttribute(this, DEBUG_ATTR);
    }
  }

  protected createContextProvider(context: any) {
    const cp = new ContextProvider(this, {context});
    cp.setValue(this);
    return cp;
  }

  protected updateContextProvider(provider: ContextProvider<any, any>) {
    provider.setValue(this);
    provider.hostConnected();
  }

  protected clearContextProvider(provider: ContextProvider<any, any>) {
    provider.setValue(undefined);
  }

  protected signal(name: keyof this): Signal<any> {
    return findObjectSignalByName(this, name);
  }

  protected signals(...names: (keyof this)[]): Signal<any>[] {
    return Array.from(new Set(names))
      .map((name) => findObjectSignalByName(this, name))
      .filter(Boolean);
  }
}
