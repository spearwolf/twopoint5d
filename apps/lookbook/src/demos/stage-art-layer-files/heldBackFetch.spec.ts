import {describe, expect, it, vi} from 'vitest';
import {type FileRequestState, heldBackFetch, waitOrAbort} from './heldBackFetch.js';

const BASE = 'https://lookbook.test/assets/shelf/';

/** A `fetch` whose responses the test hands over, with the urls it was asked for. */
function fakeFetch(status = 200) {
  const asked: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    asked.push(String(input));
    return new Response('png', {status});
  }) as unknown as typeof fetch;
  return {impl, asked};
}

/** A wait the test lets go of by hand. */
function manualWait() {
  const pending: {ms: number; resolve: () => void; reject: (reason: unknown) => void}[] = [];
  const wait = (ms: number, signal: AbortSignal | undefined) =>
    new Promise<void>((resolve, reject) => {
      pending.push({ms, resolve, reject});
      signal?.addEventListener('abort', () => reject(signal.reason), {once: true});
    });
  return {wait, pending};
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('heldBackFetch', () => {
  it('passes a request outside the base through, untold and unheld', async () => {
    const {impl, asked} = fakeFetch();
    const begin = vi.fn();
    const fetch = heldBackFetch(impl, {base: BASE, begin});

    const response = await fetch('https://lookbook.test/assets/other.png');

    expect(response.ok).toBe(true);
    expect(asked).toEqual(['https://lookbook.test/assets/other.png']);
    expect(begin).not.toHaveBeenCalled();
  });

  it('holds a response under the base for its time, and tells each step', async () => {
    const {impl} = fakeFetch();
    const {wait, pending} = manualWait();
    const states: [string, FileRequestState][] = [];
    const fetch = heldBackFetch(impl, {
      base: BASE,
      begin: (url) => ({
        holdMs: url.endsWith('wall@240.png') ? 400 : 0,
        tell: (state) => states.push([url.slice(BASE.length), state]),
      }),
      wait,
    });

    let settled = false;
    const held = fetch(`${BASE}wall@240.png`).then((response) => {
      settled = true;
      return response;
    });
    await flush();

    expect(states).toEqual([
      ['wall@240.png', 'requested'],
      ['wall@240.png', 'held'],
    ]);
    expect(pending.map((p) => p.ms)).toEqual([400]);
    expect(settled).toBe(false);

    pending[0]!.resolve();
    expect((await held).ok).toBe(true);
    expect(states.at(-1)).toEqual(['wall@240.png', 'arrived']);
  });

  it('holds nothing where holdFor answers 0', async () => {
    const {impl} = fakeFetch();
    const wait = vi.fn();
    const states: FileRequestState[] = [];
    const fetch = heldBackFetch(impl, {base: BASE, begin: () => ({holdMs: 0, tell: (state) => states.push(state)}), wait});

    await fetch(new URL(`${BASE}rail.png`));

    expect(wait).not.toHaveBeenCalled();
    expect(states).toEqual(['requested', 'arrived']);
  });

  it('tells a response that is not ok as failed with its status, and hands it on', async () => {
    const {impl} = fakeFetch(404);
    const told: [FileRequestState, string | undefined][] = [];
    const fetch = heldBackFetch(impl, {
      base: BASE,
      begin: () => ({holdMs: 0, tell: (state, detail) => told.push([state, detail])}),
    });

    const response = await fetch(new Request(`${BASE}missing/nautilus.png`));

    expect(response.status).toBe(404);
    expect(told.at(-1)).toEqual(['failed', '404']);
  });

  it('tells a request that throws as failed, and throws on', async () => {
    const impl = vi.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    const told: [FileRequestState, string | undefined][] = [];
    const fetch = heldBackFetch(impl, {
      base: BASE,
      begin: () => ({holdMs: 0, tell: (state, detail) => told.push([state, detail])}),
    });

    await expect(fetch(`${BASE}tag.png`)).rejects.toThrow('network down');
    expect(told).toEqual([
      ['requested', undefined],
      ['failed', 'network down'],
    ]);
  });

  it('ends a held response with the reason of the signal once the request is aborted', async () => {
    const {impl} = fakeFetch();
    const {wait} = manualWait();
    const states: FileRequestState[] = [];
    const fetch = heldBackFetch(impl, {base: BASE, begin: () => ({holdMs: 1000, tell: (state) => states.push(state)}), wait});
    const abort = new AbortController();

    const held = fetch(`${BASE}shelf.png`, {signal: abort.signal});
    await flush();
    abort.abort(new DOMException('the art was disposed', 'AbortError'));

    await expect(held).rejects.toThrow('the art was disposed');
    expect(states).toEqual(['requested', 'held', 'failed']);
  });

  it('tells the steps of a request to the reporter it began with, not to one of a later load', async () => {
    const {impl} = fakeFetch();
    const {wait, pending} = manualWait();
    const first: FileRequestState[] = [];
    const second: FileRequestState[] = [];
    let reporter = first;
    const fetch = heldBackFetch(impl, {
      base: BASE,
      begin: () => {
        const told = reporter;
        return {holdMs: 1000, tell: (state) => told.push(state)};
      },
      wait,
    });

    const early = new AbortController();
    const dropped = fetch(`${BASE}wall@240.png`, {signal: early.signal});
    await flush();
    // a new load begins, and the request of the old one is aborted only then
    reporter = second;
    const next = fetch(`${BASE}wall@240.png`);
    await flush();
    early.abort('dropped');
    await expect(dropped).rejects.toBe('dropped');
    pending[1]!.resolve();
    await next;

    expect(first).toEqual(['requested', 'held', 'failed']);
    expect(second).toEqual(['requested', 'held', 'arrived']);
  });
});

describe('waitOrAbort', () => {
  it('resolves after its time', async () => {
    vi.useFakeTimers();
    try {
      let done = false;
      const waiting = waitOrAbort(300, undefined).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(299);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await waiting;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects at once for a signal aborted before, and on the abort of one while it waits', async () => {
    const before = new AbortController();
    before.abort('gone');
    await expect(waitOrAbort(300, before.signal)).rejects.toBe('gone');

    vi.useFakeTimers();
    try {
      const during = new AbortController();
      const waiting = waitOrAbort(300, during.signal);
      during.abort('dropped');
      await expect(waiting).rejects.toBe('dropped');
      // the timer is cleared: nothing is left to fire
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
