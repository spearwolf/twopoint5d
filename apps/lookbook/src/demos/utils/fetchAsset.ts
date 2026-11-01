import type {JsonCheck} from './checkJson';

/**
 * The text of the file at `url`. A failure names `subject` and the url: a fetch that cannot reach
 * the file rejects with `<subject>: <url> could not be fetched` and the reason as its `cause`, an
 * answer that is not ok with `<subject>: <url> answered <status>`.
 *
 * @param subject who asks, the first word of every message: a module (`'MothChapel'`), a demo
 *   (`'ui-panels'`) or a function
 */
export async function fetchText(subject: string, url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new Error(`${subject}: ${url} could not be fetched`, {cause});
  }
  if (!response.ok) {
    throw new Error(`${subject}: ${url} answered ${response.status}`);
  }
  return response.text();
}

/**
 * The JSON of the file at `url`, parsed and held to `check`; it fails as {@link fetchText} does,
 * and a body that is no JSON — the HTML page of a server that does not know the file — rejects with
 * `<subject>: <url> is no JSON` and the `SyntaxError` as its `cause`.
 *
 * `check` holds the value to what the caller reads (see `checkJson.ts`); a value it refuses
 * rejects with `<subject>: <url> is not what <subject> reads: <message>` and the `TypeError` of
 * the check as its `cause`, and the message names the field that does not fit. Anything else a
 * check throws is a fault of the check, not of the file, and rejects as it is. The layout files of
 * the demos are written by the generators under `assets-src/`, committed with their demo, and
 * `assets-src/README.md` is their contract; what the library reads — the atlases — the
 * `TextureStore` checks itself.
 */
export async function fetchJson<T>(subject: string, url: string, check: JsonCheck<T>): Promise<T> {
  const text = await fetchText(subject, url);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new Error(`${subject}: ${url} is no JSON`, {cause});
  }
  try {
    return check(value, '');
  } catch (cause) {
    // a check refuses with a TypeError (see `JsonCheck`); anything else is a fault of the check,
    // not of the file, and passes on as it is
    if (!(cause instanceof TypeError)) throw cause;
    throw new Error(`${subject}: ${url} is not what ${subject} reads: ${cause.message}`, {cause});
  }
}
