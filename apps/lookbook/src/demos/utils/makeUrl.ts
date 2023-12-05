let baseUrl = import.meta.env.BASE_URL;

if (!baseUrl.endsWith('/')) {
  baseUrl += '/';
}

function makeUrl(url: string, pathPrefix = ''): string {
  if (url.startsWith('http')) {
    return url;
  }
  const prefix = pathPrefix.startsWith('/') ? pathPrefix.substring(1) : pathPrefix;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${prefix}${path}`;
}

export {baseUrl, makeUrl};
