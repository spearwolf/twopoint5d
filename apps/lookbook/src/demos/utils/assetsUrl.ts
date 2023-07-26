const baseUrl = import.meta.env.BASE_URL;

export default function assetsUrl(url: string): string {
  if (url.startsWith('http')) {
    return url;
  }
  if (url.startsWith('/')) {
    return `${baseUrl}assets${url}`;
  }
  return `${baseUrl}assets/${url}`;
}
