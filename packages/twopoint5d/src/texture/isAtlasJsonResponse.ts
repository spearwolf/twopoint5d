import type {
  TexturePackerArrayFrameData,
  TexturePackerFrameData,
  TexturePackerJsonData,
  TexturePackerMetaData,
} from './TexturePackerJson.js';

// The atlas json as it arrives from a url: everything a texture packer json carries, except that
// the image url may be missing — an `overrideImageUrl` answers for it just as well. Once the url
// is resolved the response becomes a full `TexturePackerJsonData`.
export type AtlasJsonResponse = Omit<TexturePackerJsonData, 'meta'> & {
  meta: Omit<TexturePackerMetaData, 'image'> & {image?: string};
};

// an object whose named properties are all numbers
const isRect = (value: unknown, keys: string[]): boolean =>
  typeof value === 'object' && value != null && keys.every((key) => typeof (value as Record<string, unknown>)[key] === 'number');

// `setResponseType('json')` hands the callback a parsed object, and what that object carries is
// whatever the url answered with — so it is checked before it is read. Every property the check
// lets through is one the loader and its callers may rely on afterwards.
const isFrameData = (value: unknown): value is TexturePackerFrameData => {
  if (typeof value !== 'object' || value == null) return false;
  const {frame} = value as Partial<TexturePackerFrameData>;
  if (typeof frame !== 'object' || frame == null) return false;
  if (!(
    typeof frame.x === 'number' &&
    typeof frame.y === 'number' &&
    typeof frame.w === 'number' &&
    typeof frame.h === 'number'
  )) {
    return false;
  }
  const {rotated, trimmed, spriteSourceSize, sourceSize} = value as Partial<TexturePackerFrameData>;
  return (
    (rotated === undefined || typeof rotated === 'boolean') &&
    (trimmed === undefined || typeof trimmed === 'boolean') &&
    (spriteSourceSize === undefined || isRect(spriteSourceSize, ['x', 'y', 'w', 'h'])) &&
    (sourceSize === undefined || isRect(sourceSize, ['w', 'h']))
  );
};

const isArrayFrameData = (value: unknown): value is TexturePackerArrayFrameData =>
  isFrameData(value) && typeof (value as Partial<TexturePackerArrayFrameData>).filename === 'string';

export const isAtlasJsonResponse = (value: unknown): value is AtlasJsonResponse => {
  if (typeof value !== 'object' || value == null) return false;
  const {frames, meta} = value as Partial<AtlasJsonResponse>;
  if (typeof frames !== 'object' || frames == null) return false;
  // "JSON Array" (every entry names itself by `filename`) or "JSON Hash" (the key is the name); a name
  // that appears twice is no concern of this check, `TexturePackerJson.parse()` refuses it for every way in
  if (!(Array.isArray(frames) ? frames.every(isArrayFrameData) : Object.values(frames).every(isFrameData))) return false;
  if (typeof meta !== 'object' || meta == null) return false;
  const {size} = meta;
  return typeof size === 'object' && size != null && typeof size.w === 'number' && typeof size.h === 'number';
};
