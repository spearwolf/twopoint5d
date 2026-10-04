import type {Texture} from 'three/webgpu';

export const TEXTURE_PREVIEW_ID = 'texture-preview';

/**
 * Show a copy of the image of `texture` in the `#texture-preview` element of the page,
 * which `TexturePreview.astro` writes. A copy: an `<img>` in the layout answers width and
 * height as its CSS sizes it, and three.js reads the size of the texture from there.
 */
export function showTexturePreview(texture: Texture): void {
  const preview = document.getElementById(TEXTURE_PREVIEW_ID);
  if (!preview) {
    throw new Error(`[lookbook] showTexturePreview(): the page has no #${TEXTURE_PREVIEW_ID} element`);
  }
  if (!(texture.image instanceof HTMLImageElement)) {
    // biome-ignore lint/suspicious/noConsole: the demo logs to the devtools on purpose
    console.warn(
      `[lookbook] showTexturePreview(): the image of the texture "${texture.name}" is no <img>, there is nothing to copy`,
      texture.image,
    );
    return;
  }
  preview.appendChild(texture.image.cloneNode());
}
