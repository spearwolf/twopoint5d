import type {TexturePackerFrameData, TexturePackerJsonData, TexturePackerMetaData} from './TexturePackerJson.js';

// The atlas json as it arrives from a url: everything a texture packer json carries, except that
// the image url may be missing — an `overrideImageUrl` answers for it just as well. Once the url
// is resolved the response becomes a full `TexturePackerJsonData`.
export type AtlasJsonResponse = Omit<TexturePackerJsonData, 'meta'> & {
  meta: Omit<TexturePackerMetaData, 'image'> & {image?: string};
};

// `setResponseType('json')` hands the callback a parsed object, and what that object carries is
// whatever the url answered with — so it is checked before it is read. Every property the check
// lets through is one the loader and its callers may rely on afterwards.
const isFrameData = (value: unknown): value is TexturePackerFrameData => {
  if (typeof value !== 'object' || value == null) return false;
  const {frame} = value as Partial<TexturePackerFrameData>;
  if (typeof frame !== 'object' || frame == null) return false;
  return typeof frame.x === 'number' && typeof frame.y === 'number' && typeof frame.w === 'number' && typeof frame.h === 'number';
};

export const isAtlasJsonResponse = (value: unknown): value is AtlasJsonResponse => {
  if (typeof value !== 'object' || value == null) return false;
  const {frames, meta} = value as Partial<AtlasJsonResponse>;
  if (typeof frames !== 'object' || frames == null) return false;
  if (!Object.values(frames).every(isFrameData)) return false;
  if (typeof meta !== 'object' || meta == null) return false;
  const {size} = meta;
  return typeof size === 'object' && size != null && typeof size.w === 'number' && typeof size.h === 'number';
};
