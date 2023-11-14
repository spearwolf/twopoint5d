const hasConsole = typeof console !== 'undefined';

const canLog = hasConsole && typeof console.log === 'function';
const canWarn = hasConsole && typeof console.warn === 'function';
const canError = hasConsole && typeof console.error === 'function';
const canTime =
  hasConsole &&
  typeof console.time === 'function' &&
  typeof console.timeLog === 'function' &&
  typeof console.timeEnd === 'function';
const canGroup =
  hasConsole &&
  typeof console.group === 'function' &&
  typeof console.groupCollapsed === 'function' &&
  typeof console.groupEnd === 'function';

const g_loggers = new Map<string, ConsoleLogger>();

export class ConsoleLogger {
  static Styles = {
    log: 'color:#969694;background:#323436;font-size:80%;display:inline-flex;align-items:center;justify-content:center;padding:0.1em 0.5em;border-radius:2px;margin-right:0.3em',
    warn: 'color:#D59D00;background:#323436;font-size:80%;display:inline-flex;align-items:center;justify-content:center;padding:0.1em 0.5em;border-radius:2px;margin-right:0.3em',
    error:
      'color:#d96687;background:#323436;font-size:80%;display:inline-flex;align-items:center;justify-content:center;padding:0.1em 0.5em;border-radius:2px;margin-right:0.3em',
  };

  static getLogger(namespace: string): ConsoleLogger {
    if (!g_loggers.has(namespace)) {
      g_loggers.set(namespace, new ConsoleLogger(namespace));
    }
    return g_loggers.get(namespace)!;
  }

  parent?: ConsoleLogger;

  readonly namespace: string;

  curTimeLabel?: string;

  styleKey: string = 'log';

  active = true;

  constructor(namespace: string, parent?: ConsoleLogger) {
    this.namespace = namespace;
    this.parent = parent;
  }

  isActive(force = false) {
    return force || this.active;
  }

  getNamespaces(): string[] {
    return [this.namespace, ...(this.parent?.getNamespaces() ?? [])];
  }

  log(...args: unknown[]) {
    if (canLog) {
      console.log(...this.prependNamespaces(args, this.styleKey));
    }
  }

  warn(...args: unknown[]) {
    if (canWarn) {
      console.warn(...this.prependNamespaces(args, this.styleKey, ['warn:WARN']));
    }
  }

  error(...args: unknown[]) {
    if (canError) {
      console.error(...this.prependNamespaces(args, this.styleKey, ['error:ERROR']));
    }
  }

  time(label: string) {
    if (canTime) {
      this.curTimeLabel = label;
      console.time(label);
    }
  }

  timeLog(label = this.curTimeLabel) {
    if (canTime) {
      console.timeLog(label);
    }
  }

  timeEnd(label = this.curTimeLabel) {
    if (canTime) {
      console.timeEnd(label);
      this.curTimeLabel = undefined;
    }
  }

  group(label: string, fn?: () => void) {
    if (canGroup) {
      console.group(label);
      if (fn) {
        fn();
        console.groupEnd();
      }
    } else if (fn) {
      fn();
    }
  }

  groupCollapsed(label: string, fn?: () => void) {
    if (canGroup) {
      console.groupCollapsed(label);
      if (fn) {
        fn();
        console.groupEnd();
      }
    } else if (fn) {
      fn();
    }
  }

  groupEnd() {
    if (canGroup) {
      console.groupEnd();
    }
  }

  private prependNamespaces(args: unknown[], defStyleKey: string = 'log', extraNamespaces?: string[]): unknown[] {
    const tags: string[] = [];
    const styles: string[] = [];

    const appendTag = (label: string) => {
      let tag = label;
      let skey = defStyleKey;
      const delidx = label.indexOf(':');
      if (delidx > 0) {
        skey = label.substring(0, delidx);
        tag = label.substring(delidx + 1);
      }
      tags.push(`%c${tag}`);
      // @ts-ignore
      styles.push(ConsoleLogger.Styles[skey]);
    };

    this.getNamespaces().forEach(appendTag);
    extraNamespaces?.forEach(appendTag);

    return [...tags, ...styles, ...args];
  }
}
