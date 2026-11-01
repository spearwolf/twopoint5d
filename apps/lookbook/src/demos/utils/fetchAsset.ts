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
 * The JSON of the file at `url`, parsed; it fails as {@link fetchText} does, and a body that is no
 * JSON — the HTML page of a server that does not know the file — rejects with
 * `<subject>: <url> is no JSON` and the `SyntaxError` as its `cause`.
 *
 * The shape of the value is not checked: `T` is what the caller expects. The layout files of the
 * demos are written by the generators under `assets-src/`, committed with their demo, and
 * `assets-src/README.md` is their contract; what the library reads — the atlases — the
 * `TextureStore` checks itself.
 */
export async function fetchJson<T>(subject: string, url: string): Promise<T> {
  const text = await fetchText(subject, url);
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`${subject}: ${url} is no JSON`, {cause});
  }
}
