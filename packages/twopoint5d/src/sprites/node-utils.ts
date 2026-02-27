import {
  add,
  attribute,
  cameraPosition,
  cross,
  div,
  float,
  mod,
  modelViewMatrix,
  mul,
  normalize,
  sub,
  texture,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import type {Node, Texture} from 'three/webgpu';

export const vertexByInstancePosition = (params?: {
  vertexPosition?: Node<'vec3'>;
  instancePosition?: Node<'vec3'>;
  scale?: Node<'vec3'>;
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
  vertexPosition?: Node<'vec3'>;
  instancePosition?: Node<'vec3'>;
  scale?: Node<'vec3'>;
}) => {
  const billboardPosition = params?.instancePosition ?? attribute('instancePosition');
  const billboardSize = params?.scale ?? attribute('quadSize');
  const vertexPosition = params?.vertexPosition ?? attribute('position');

  const look = normalize(sub(cameraPosition, billboardPosition));

  // const cameraUp = vec3(modelViewMatrix[0].y, modelViewMatrix[1].y, modelViewMatrix[2].y);
  // XXX fix me - this is a hack but it seems to be that the types for modelViewMatrix are wrong
  const cameraUp = vec3((modelViewMatrix as any)[0].y, (modelViewMatrix as any)[1].y, (modelViewMatrix as any)[2].y);

  const billboardRight = normalize(cross(cameraUp, look));
  const billboardUp = normalize(cross(look, billboardRight));

  return add(
    billboardPosition,
    add(mul(billboardRight, mul(vertexPosition.x, billboardSize.x)), mul(billboardUp, mul(vertexPosition.y, billboardSize.y))),
  );
};

export const colorFromTextureByTexCoords = (colorMap: Texture, params?: {texCoords?: Node<'vec4'>; uv?: Node<'vec2'>}) => {
  const texCoords = params?.texCoords ?? attribute('texCoords');
  const uv = params?.uv ?? attribute('uv');

  // vTexCoords = vec2(texCoords.x + (uv.x * texCoords.z), texCoords.y + (uv.y * texCoords.w));
  const vTexCoords = varying(vec2(add(texCoords.xy, mul(uv.xy, texCoords.zw))));

  // gl_FragColor = texture2D(colorMap, vTexCoords);
  return texture(colorMap, vTexCoords);
};

export const texCoordsFromIndex = (mapSize: Node<'vec2'>, ndx: Node<'int'>) => {
  // vec2 texCoordsFromIndex(in vec2 mapSize, in int ndx) {
  //   int column = int(mod(float(ndx), float(mapSize[0])));
  const column = mod(ndx.toInt().toFloat(), mapSize.x.toFloat()).toInt();
  //   int row = ndx / int(mapSize[0]);
  const row = div(ndx, mapSize.x.toInt()).toInt();
  //   return (vec2(column, row) + 0.5) / vec2(mapSize[0], mapSize[1]);
  return div(add(vec2(column, row), float(0.5)), vec2(mapSize.x, mapSize.y));
};
