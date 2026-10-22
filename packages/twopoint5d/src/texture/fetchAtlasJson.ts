import type {TextureResourceLoadFailure} from './internals.js';
import {type AtlasJsonResponse, isAtlasJsonResponse} from './isAtlasJsonResponse.js';
import {resolveRelativeUrl} from './resolveRelativeUrl.js';

/** What a fetch of an atlas json ends with: the json, or the failure an `AtlasTextureResource` reports. */
export type AtlasJsonFetch = {readonly json: AtlasJsonResponse} | {readonly failure: TextureResourceLoadFailure};

/**
 * The texture atlas json at `url`, with a `meta.image` that is a string resolved against `url`, so
 * it names the file next to the json.
 *
 * - A response that is no 2xx ends in a `failure` with its `status`.
 * - A body that is no texture atlas json ends in a `failure` without a `status`: the response was a
 *   2xx, there is no status to name.
 * - A fetch or a `json()` that throws ends in a `failure` that carries the error.
 * - Once `signal` is aborted the answer is `undefined`, whatever the fetch ended with.
 *
 * Never rejects.
 */
export const fetchAtlasJson = async (url: string, signal: AbortSignal): Promise<AtlasJsonFetch | undefined> => {
  try {
    const response = await fetch(url, {signal});
    if (signal.aborted) return undefined;
    if (!response.ok) {
      // without this check, a 4xx/5xx body that happens to satisfy isAtlasJsonResponse below
      // would be taken for a valid atlas, and the status this branch reports would be lost
      return {
        failure: {
          source: 'atlas',
          url,
          status: response.status,
          error: new Error(`TextureResource: fetch("${url}") answered ${response.status} ${response.statusText}`),
        },
      };
    }
    const atlasJson: unknown = await response.json();
    if (signal.aborted) return undefined;
    if (!isAtlasJsonResponse(atlasJson)) {
      return {
        failure: {
          source: 'atlas',
          url,
          error: new Error(`TextureResource: the response of "${url}" is no texture atlas json`),
        },
      };
    }
    // a relative image name is a file next to the atlas json, and `url` is the url this very json
    // came from — the resource that asked for it may already name the next one
    const image = atlasJson.meta.image;
    return {
      json:
        typeof image === 'string' ? {...atlasJson, meta: {...atlasJson.meta, image: resolveRelativeUrl(image, url)}} : atlasJson,
    };
  } catch (error) {
    if (signal.aborted) return undefined;
    return {failure: {source: 'atlas', url, error}};
  }
};
