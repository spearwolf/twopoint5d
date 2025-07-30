import {
  add,
  attribute,
  cameraPosition,
  cross,
  modelViewMatrix,
  mul,
  normalize,
  sub,
  texture,
  varying,
  vec2,
  vec3,
  type ShaderNodeObject,
} from 'three/tsl';
import {Texture, type Node} from 'three/webgpu';

export const vertexByInstancePosition = (params?: {
  vertexPosition?: ShaderNodeObject<Node>;
  instancePosition?: ShaderNodeObject<Node>;
  scale?: ShaderNodeObject<Node>;
}) => {
  const position = params?.vertexPosition ?? attribute('position');
  const instancePosition = params?.instancePosition ?? attribute('instancePosition');
  const scale = params?.scale;

  if (scale) {
    return add(mul(position, scale), instancePosition);
  } else {
    return add(position, instancePosition);
  }
};

export const billboardVertexByInstancePosition = (params?: {
  vertexPosition?: ShaderNodeObject<Node>;
  instancePosition?: ShaderNodeObject<Node>;
  scale?: ShaderNodeObject<Node>;
}) => {
  const billboardPosition = params?.instancePosition ?? attribute('instancePosition');
  const billboardSize = params?.scale ?? attribute('quadSize');
  const vertexPosition = params?.vertexPosition ?? attribute('position');

  const look = normalize(sub(cameraPosition, billboardPosition));
  const cameraUp = vec3(modelViewMatrix[0].y, modelViewMatrix[1].y, modelViewMatrix[2].y);
  const billboardRight = normalize(cross(cameraUp, look));
  const billboardUp = normalize(cross(look, billboardRight));

  return add(
    billboardPosition,
    add(mul(billboardRight, mul(vertexPosition.x, billboardSize.x)), mul(billboardUp, mul(vertexPosition.y, billboardSize.y))),
  );
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
