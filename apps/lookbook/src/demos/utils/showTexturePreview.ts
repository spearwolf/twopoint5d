import type {Texture} from 'three/webgpu';

/**
 * Show a copy of the image of `texture` in the `#texture-preview` element of the page. A copy: an
 * `<img>` in the layout answers width and height as its CSS sizes it, and three.js reads the size
 * of the texture from there.
 */
export function showTexturePreview(texture: Texture): void {
  const preview = document.getElementById('texture-preview');
  if (!preview) {
    throw new Error('[lookbook] showTexturePreview(): the page has no #texture-preview element');
  }
  if (!(texture.image instanceof HTMLImageElement)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[lookbook] showTexturePreview(): the image of the texture "${texture.name}" is no <img>, there is nothing to copy`,
      texture.image,
    );
    return;
  }
  preview.appendChild(texture.image.cloneNode());
}
