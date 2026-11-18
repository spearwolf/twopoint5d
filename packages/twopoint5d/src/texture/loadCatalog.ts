import {describeValue} from '../utils/describeValue.js';
import type {TextureStoreErrorEvent} from './TextureStore.js';
import type {TextureStoreData} from './types.js';

export const hrefOf = (url: string | URL): string => (typeof url === 'string' ? url : url.href);

// one message for a load that never got as far as a parse, naming the step that failed and
// whatever the failure can be pinned to — the url that was being fetched, the id of the item
// that is at fault — an item without a source has no url of its own —, or the url of the catalog
// for what belongs to it as a whole
export const loadFailedError = (source: string, what: string | URL | undefined, cause: unknown): Error =>
  new Error(`TextureStore: load failed at the ${source} step${what != null ? `: ${describeValue(hrefOf(what))}` : ''}`, {cause});

/** What one load of a catalog takes from the store it loads for. */
export interface CatalogLoad<T> {
  /** The url of the catalog. */
  readonly url: string | URL;
  /** The call the messages name, `loadAsync("<url>")`. */
  readonly what: string;
  /** The signal of the caller, or `undefined`. */
  readonly signal: AbortSignal | undefined;
  /** Aborted when the store is disposed. */
  readonly disposal: AbortSignal;
  /** The error the load rejects with once `disposal` aborts. */
  disposedError(): Error;
  /** Cuts short the load of the store that is still under way, and books `cutShort` in its place. */
  supersede(cutShort: () => void): void;
  /** Takes `cutShort` back, if it is still the one booked. */
  withdraw(cutShort: () => void): void;
  /** Reports a step that failed as an `error` event of the store. */
  report(event: TextureStoreErrorEvent): void;
  /** Parses the catalog: the load resolves with what it answers, and a throw fails the parse step. */
  parse(data: TextureStoreData): T;
}

/**
 * Fetches the catalog at `load.url` and hands it to `load.parse`, cut short by the signal of the
 * caller, by the disposal of the store and by the next load of the same store.
 * TextureStore#loadAsync() says what the promise does.
 */
export const loadCatalog = <T>(load: CatalogLoad<T>): Promise<T> => {
  const {url, what, signal} = load;
  if (signal?.aborted) return Promise.reject(new DOMException(`TextureStore: ${what} aborted`, 'AbortError'));

  return new Promise<T>((resolve, reject) => {
    // the fetch listens to one signal, and two sides pull it: the caller and dispose()
    const fetchAbort = new AbortController();
    let settled = false;

    // once the attempt is over, nothing of it stays on the caller's signal or on the store
    const settle = () => {
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      load.disposal.removeEventListener('abort', onDispose);
      load.withdraw(onSuperseded);
    };

    const cutShort = (error: Error) => {
      if (settled) return;
      settle();
      fetchAbort.abort();
      reject(error);
    };
    const onAbort = () => cutShort(new DOMException(`TextureStore: ${what} aborted`, 'AbortError'));
    const onDispose = () => cutShort(load.disposedError());
    // a load whose parse has begun is settled and cut short by nothing, a loadAsync() that a
    // listener inside that parse starts included; so is a load whose step has failed, a loadAsync()
    // that a listener of its `error` event starts included; one that is cut short reports nothing,
    // as one whose signal aborts
    const onSuperseded = () =>
      cutShort(new DOMException(`TextureStore: ${what} aborted: a later loadAsync() on this store took its place`, 'AbortError'));

    signal?.addEventListener('abort', onAbort, {once: true});
    load.disposal.addEventListener('abort', onDispose, {once: true});

    load.supersede(onSuperseded);

    // A step that fails is reported twice: to whoever listens to the store, and to this caller.
    // emitSafe(): every listener hears it, and one that throws is reported on the console by
    // eventize instead of taking the place of the rejection this caller is owed
    const failed = (source: 'fetch' | 'parse', error: unknown, status?: number): Error => {
      load.report(status === undefined ? {source, url, error} : {source, url, status, error});
      return loadFailedError(source, url, error);
    };

    // A step before the parse that fails ends the attempt before it is reported: a listener of the
    // `error` event that starts another loadAsync(), aborts the signal or disposes the store finds
    // this load over, and the promise rejects with the failure the event told of
    const fail = (source: 'fetch' | 'parse', error: unknown, status?: number): void => {
      settle();
      reject(failed(source, error, status));
    };

    // An attempt that was cut short ends at the next check: what arrives after it is dropped
    // and reports nothing. The check follows every await, because a body that is already
    // there — a mocked `Response#json()` among them — resolves without asking the signal.
    const attempt = async (): Promise<void> => {
      let response: Response;
      try {
        response = await fetch(url, {signal: fetchAbort.signal});
      } catch (error) {
        if (!settled) fail('fetch', error);
        return;
      }
      if (settled) return;
      if (!response.ok) {
        // a status is a failure of the request, not of the parsing — an error response with
        // a JSON body would otherwise pass for a catalog
        fail(
          'fetch',
          new Error(`TextureStore: fetch(${describeValue(hrefOf(url))}) answered ${response.status} ${response.statusText}`),
          response.status,
        );
        return;
      }
      let data: TextureStoreData;
      try {
        data = await response.json();
      } catch (error) {
        if (!settled) fail('parse', error);
        return;
      }
      if (settled) return;
      // Once the parse begins, the load is done: parse() runs through in one go, and a listener
      // inside it — of `ready`, of a resource, of `error` — that aborts the signal or disposes the
      // store finds the data parsed. So the promise settles here, before the parse, and not a
      // microtask after it, by when such an abort would already have rejected it
      settle();
      let parsed: T;
      try {
        parsed = load.parse(data);
      } catch (error) {
        reject(failed('parse', error));
        return;
      }
      resolve(parsed);
    };

    // attempt() settles every failure it reports itself; a throw it does not foresee still rejects
    // the promise instead of leaving it pending
    attempt().catch((error: unknown) => {
      if (settled) return;
      settle();
      reject(error);
    });
  });
};
