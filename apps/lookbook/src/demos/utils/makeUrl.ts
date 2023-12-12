let baseUrl = import.meta.env.BASE_URL;

if (!baseUrl.endsWith('/')) {
  baseUrl += '/';
}

function makeUrl(url: string, pathPrefix = ''): string {
  if (url.startsWith('http')) {
    return url;
  }
  const prefix = pathPrefix.startsWith('/') ? pathPrefix.substring(1) : pathPrefix;
  let path = prefix + (url.startsWith('/') ? url : `/${url}`);
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  return `${baseUrl}${path}`;
}

export {baseUrl, makeUrl};
