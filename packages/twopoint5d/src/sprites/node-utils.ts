import {add, attribute, mul, texture, varying, vec2, type ShaderNodeObject} from 'three/tsl';
import {Texture, type Node} from 'three/webgpu';

export const positionByInstancePosition = (params?: {
  position?: ShaderNodeObject<Node>;
  instancePosition?: ShaderNodeObject<Node>;
  scale?: ShaderNodeObject<Node>;
}) => {
  const position = params?.position ?? attribute('position');
  const instancePosition = params?.instancePosition ?? attribute('instancePosition');
  const scale = params?.scale;

  if (scale) {
    return add(mul(position, scale), instancePosition);
  } else {
    return add(position, instancePosition);
  }
};

export const colorFromTextureByTexCoords = (
  colorMap: Texture,
  params?: {texCoords?: ShaderNodeObject<Node>; uv?: ShaderNodeObject<Node>},
) => {
  const texCoords = params?.texCoords ?? attribute('texCoords');
  const uv = params?.uv ?? attribute('uv');

  // vTexCoords = vec2(texCoords.x + (uv.x * texCoords.z), texCoords.y + (uv.y * texCoords.w));
  const vTexCoords = varying(vec2(add(texCoords.xy, mul(uv.xy, texCoords.zw))));

  // gl_FragColor = texture2D(colorMap, vTexCoords);
  return texture(colorMap, vTexCoords);
};
