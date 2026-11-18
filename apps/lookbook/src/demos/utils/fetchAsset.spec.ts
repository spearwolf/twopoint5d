import {describe, expect, it, vi} from 'vitest';
import {type JsonCheck, JsonCheckError, jsonNumber} from './checkJson';
import {fetchJson, fetchText} from './fetchAsset';

/** Stubs `fetch` with one that answers `body` with `status`. */
const answer = (body: string, status = 200): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, {status})),
  );
};

/** The error a promise rejects with. */
async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error(`the promise rejected with a value that is no Error: ${String(error)}`);
  }
  throw new Error('the promise resolved');
}

describe('fetchText', () => {
  it('answers the text of the file', async () => {
    answer('the text');
    await expect(fetchText('MothChapel', 'room.json')).resolves.toBe('the text');
  });

  it('rejects with the subject and the url as the fetch rejects, and the reason as its cause', async () => {
    const reason = new TypeError('network down');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw reason;
      }),
    );
    const error = await rejection(fetchText('MothChapel', 'room.json'));
    expect(error.message).toBe('MothChapel: room.json could not be fetched');
    expect(error.cause).toBe(reason);
  });

  it('rejects with the status of an answer that is not ok', async () => {
    answer('not here', 404);
    await expect(fetchText('MothChapel', 'room.json')).rejects.toThrow(new Error('MothChapel: room.json answered 404'));
  });
});

describe('fetchJson', () => {
  it('answers the value the check accepts', async () => {
    answer('4');
    await expect(fetchJson('MothChapel', 'room.json', jsonNumber)).resolves.toBe(4);
  });

  it('rejects a value the check refuses as a fault of the file, with the refusal as its cause', async () => {
    answer('"4"');
    const error = await rejection(fetchJson('MothChapel', 'room.json', jsonNumber));
    expect(error.message).toBe('MothChapel: room.json is not what MothChapel reads: the root must be a number, got "4"');
    expect(error.cause).toBeInstanceOf(JsonCheckError);
    expect(error.cause).toHaveProperty('message', 'the root must be a number, got "4"');
  });

  it('rejects a body that is no JSON, with the SyntaxError as its cause', async () => {
    answer('<html></html>');
    const error = await rejection(fetchJson('MothChapel', 'room.json', jsonNumber));
    expect(error.message).toBe('MothChapel: room.json is no JSON');
    expect(error.cause).toBeInstanceOf(SyntaxError);
  });

  it('passes on a TypeError that a fault of the check throws, unwrapped', async () => {
    answer('{}');
    const fault = new TypeError('a fault of the check');
    const check: JsonCheck<never> = () => {
      throw fault;
    };
    await expect(fetchJson('MothChapel', 'room.json', check)).rejects.toBe(fault);
  });

  it('passes on anything else a check throws as it is', async () => {
    answer('{}');
    const fault = new RangeError('out of range');
    const check: JsonCheck<never> = () => {
      throw fault;
    };
    await expect(fetchJson('MothChapel', 'room.json', check)).rejects.toBe(fault);
  });
});
