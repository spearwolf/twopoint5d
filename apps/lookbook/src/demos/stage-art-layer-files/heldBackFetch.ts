/** What became of the request of one file, as the page shows it. */
export type FileRequestState = 'requested' | 'held' | 'arrived' | 'failed';

/** What a request under the base is: how long its response is held, and whom its steps are told. */
export interface HeldRequest {
  /** How long the response is held back once it is there, in milliseconds; 0 holds nothing. */
  readonly holdMs: number;
  /** Told each step of the request; `detail` is the status or the error of a failure. */
  tell(state: FileRequestState, detail?: string): void;
}

export interface HeldBackFetchOptions {
  /** The absolute url the files lie under: a request of another url passes through untouched. */
  readonly base: string;
  /**
   * Called as a request under `base` starts. What it answers stays with that request: a request of
   * an earlier load, aborted after a new load has begun, tells the steps it has left to the reporter
   * of its own load, not to the new one.
   */
  begin(url: string): HeldRequest;
  /** Resolves after `ms`, or rejects with the reason of `signal` once it aborts. `waitOrAbort` by default. */
  wait?(ms: number, signal: AbortSignal | undefined): Promise<void>;
}

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A timer that lets go of a held response as the request is aborted, so a dropped load ends at once. */
export function waitOrAbort(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, {once: true});
  });
}

/**
 * A `fetch` that answers every request under `base` with the response of `fetchImpl`, held back for
 * a while once it has arrived — a slow network for the files of one demo, made of a promise that
 * waits and nothing that loads the machine. `begin(url)` says how long and whom to tell each step.
 * An abort of the request ends the wait with the reason of its signal, as `fetch` itself would.
 */
export function heldBackFetch(fetchImpl: typeof fetch, options: HeldBackFetchOptions): typeof fetch {
  const wait = options.wait ?? waitOrAbort;
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    if (!url.startsWith(options.base)) return fetchImpl(input, init);
    const request = options.begin(url);
    request.tell('requested');
    let response: Response;
    try {
      response = await fetchImpl(input, init);
    } catch (error) {
      request.tell('failed', messageOf(error));
      throw error;
    }
    if (request.holdMs > 0) {
      request.tell('held');
      try {
        await wait(request.holdMs, init?.signal ?? undefined);
      } catch (error) {
        request.tell('failed', messageOf(error));
        throw error;
      }
    }
    if (response.ok) request.tell('arrived');
    else request.tell('failed', String(response.status));
    return response;
  };
}
