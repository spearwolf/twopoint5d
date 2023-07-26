const baseUrl = import.meta.env.BASE_URL;

export default function demoPreviewImageUrl(url: string): string {
  if (url.startsWith('http')) {
    return url;
  }
  if (url.startsWith('/')) {
    return `${baseUrl}images/demo-preview${url}`;
  }
  return `${baseUrl}images/demo-preview/${url}`;
}
