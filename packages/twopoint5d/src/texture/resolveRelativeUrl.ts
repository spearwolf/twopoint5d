// what fetch() resolves a relative url against: the document, or in a worker its location
const documentBase = (): string | undefined => {
  if (typeof document !== 'undefined') return document.baseURI;
  if (typeof location !== 'undefined') return location.href;
  return undefined;
};

const isAbsoluteUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * `url` resolved against `base`, the way a url inside a json file names a file next to that
 * file. A relative `base` is itself resolved against the document first.
 *
 * An absolute `url` comes back exactly as written, and so does an empty one. So does every
 * `url` that cannot be resolved: without a `base`, without a document to make a relative
 * `base` absolute, or against a `base` that cannot carry a relative url — a `blob:` or a
 * `data:` url. The browser then resolves it against the document, as it would have anyway.
 */
export const resolveRelativeUrl = (url: string, base: string | URL | undefined): string => {
  if (url === '' || base == null || isAbsoluteUrl(url)) return url;
  try {
    const docBase = documentBase();
    const absoluteBase = docBase != null ? new URL(base, docBase) : new URL(base);
    return new URL(url, absoluteBase).href;
  } catch {
    return url;
  }
};
