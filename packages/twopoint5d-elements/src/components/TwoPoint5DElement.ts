import {LitElement} from 'lit';
import {property} from 'lit/decorators.js';
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

  constructor() {
    super();
    this.#loggerNS = UNNAMED;
    this.#debug = readBooleanAttribute(this, DEBUG_ATTR);
  }

  override attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === DEBUG_ATTR) {
      this.debug = readBooleanAttribute(this, DEBUG_ATTR);
    }
  }
}
