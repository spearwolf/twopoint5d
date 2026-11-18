import type {TextureAtlas, TextureAtlasFrame} from '@spearwolf/twopoint5d';

/**
 * The frame `name` of `atlas`; a frame the atlas lacks throws, with `subject` — the module of the
 * scene — as the first word of the message.
 */
export function atlasFrame(atlas: TextureAtlas, subject: string, name: string): TextureAtlasFrame {
  const frame = atlas.frame(name);
  // JSON.stringify() quotes the name as checkJson.ts quotes a value: a quote or a line break in it stays visible
  if (!frame) throw new Error(`${subject}: the atlas has no frame ${JSON.stringify(name)}`);
  return frame;
}
