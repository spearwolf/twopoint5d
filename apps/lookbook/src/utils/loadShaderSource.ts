export default async function loadShaderSource(url: string): Promise<string> {
  const response = await fetch(url);
  return response.text();
}
