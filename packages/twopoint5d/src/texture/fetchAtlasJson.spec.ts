import {afterEach, describe, expect, test, vi} from 'vitest';

import {fetchAtlasJson} from './fetchAtlasJson.js';

const atlasJsonNaming = (image?: string) => ({
  frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
  meta: {...(image === undefined ? {} : {image}), size: {w: 16, h: 16}},
});

describe('fetchAtlasJson()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('a relative meta.image is resolved against the url of the json', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJsonNaming('atlas.png'))));

    const result = await fetchAtlasJson('https://example.test/a/atlas.json', new AbortController().signal);

    expect(result).toEqual({json: atlasJsonNaming('https://example.test/a/atlas.png')});
  });

  test('a json that names no image stays without one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJsonNaming())));

    const result = await fetchAtlasJson('https://example.test/a/atlas.json', new AbortController().signal);

    expect(result).toEqual({json: atlasJsonNaming()});
    expect(result && 'json' in result && 'image' in result.json.meta).toBe(false);
  });

  test('a response with a status of 404 ends in a failure that names the status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', {status: 404, statusText: 'Not Found'}));

    const result = await fetchAtlasJson('atlas.json', new AbortController().signal);

    expect(result).toEqual({
      failure: {
        source: 'atlas',
        url: 'atlas.json',
        status: 404,
        error: new Error('TextureResource: fetch("atlas.json") answered 404 Not Found'),
      },
    });
  });

  test('a body that is no texture atlas json ends in a failure without a status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({hello: 'world'})));

    const result = await fetchAtlasJson('atlas.json', new AbortController().signal);

    expect(result).toEqual({
      failure: {
        source: 'atlas',
        url: 'atlas.json',
        error: new Error('TextureResource: the response of "atlas.json" is no texture atlas json'),
      },
    });
    expect(result && 'failure' in result && 'status' in result.failure).toBe(false);
  });

  test('a fetch that rejects ends in a failure that carries its error', async () => {
    const error = new TypeError('Failed to fetch');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(error);

    const result = await fetchAtlasJson('atlas.json', new AbortController().signal);

    expect(result).toEqual({failure: {source: 'atlas', url: 'atlas.json', error}});
    expect(result && 'failure' in result && result.failure.error).toBe(error);
  });

  test('a signal aborted before the response arrives answers undefined', async () => {
    let answer!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve;
      }),
    );
    const ac = new AbortController();

    const result = fetchAtlasJson('atlas.json', ac.signal);
    ac.abort();
    answer(new Response(JSON.stringify(atlasJsonNaming('atlas.png'))));

    await expect(result).resolves.toBeUndefined();
  });

  test('a signal aborted while json() reads the body answers undefined', async () => {
    const ac = new AbortController();
    const response = new Response(JSON.stringify(atlasJsonNaming('atlas.png')));
    const json = response.json.bind(response);
    vi.spyOn(response, 'json').mockImplementation(async () => {
      ac.abort();
      return json();
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    await expect(fetchAtlasJson('atlas.json', ac.signal)).resolves.toBeUndefined();
  });

  test('a fetch that rejects once its signal is aborted answers undefined', async () => {
    const ac = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      ac.abort();
      throw new DOMException('The operation was aborted.', 'AbortError');
    });

    await expect(fetchAtlasJson('atlas.json', ac.signal)).resolves.toBeUndefined();
  });
});
