import {add, attribute, cross, div, float, mod, mul, normalize, sub, texture, vec2} from 'three/tsl';
import type {Node, Texture} from 'three/webgpu';

import {cameraPositionLocal, cameraUpLocal} from './cameraNodes.js';
import {frameUv} from './frameUv.js';

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

/**
 * Builds the position of a vertex of a quad that turns about its instance position to face the
 * camera position.
 *
 * The result lies in the local space of the mesh, which is what a `positionNode` expects; the
 * camera position is brought into that space through the inverse world matrix of the mesh. So a
 * mesh — or any of its parents — may be moved, turned and scaled evenly on all axes, and its
 * billboards still face the camera. A scale that differs from axis to axis skews the quads.
 */
export const billboardVertexByInstancePosition = (params?: {
  vertexPosition?: Node<'vec3'>;
  instancePosition?: Node<'vec3'>;
  scale?: Node<'vec3'>;
}) => {
  const billboardPosition = params?.instancePosition ?? attribute('instancePosition');
  const billboardSize = params?.scale ?? attribute('quadSize');
  const vertexPosition = params?.vertexPosition ?? attribute('position');

  // the instance position lives in the local space of the mesh, the camera position in world
  // space; the look vector needs both ends in one space
  const look = normalize(sub(cameraPositionLocal(), billboardPosition));
  const cameraUp = cameraUpLocal();

  const billboardRight = normalize(cross(cameraUp, look));
  const billboardUp = normalize(cross(look, billboardRight));

  return add(
    billboardPosition,
    add(mul(billboardRight, mul(vertexPosition.x, billboardSize.x)), mul(billboardUp, mul(vertexPosition.y, billboardSize.y))),
  );
};

/**
 * Samples `colorMap` at the texture coordinates of a sprite frame.
 *
 * At the quad position `uv = (a, b)` it reads `(s + a·u, t + b·v)`, with `s`, `t`, `u` and `v` out
 * of `texCoords`. With a `flipDiagonal` above 0.5 it swaps the two components of that lookup — the
 * lookup `TextureCoords` describes for a frame with `FLIP_DIAGONAL`, a rotated TexturePacker frame
 * among them. Without a `flipDiagonal` it swaps nothing: whoever draws frames out of an atlas that
 * may hold turned frames hands the value in, typically the `texFlipDiagonal` attribute.
 */
export const colorFromTextureByTexCoords = (
  colorMap: Texture,
  params?: {texCoords?: Node<'vec4'>; uv?: Node<'vec2'>; flipDiagonal?: Node<'float'>},
) => {
  const texCoords = params?.texCoords ?? attribute('texCoords');
  const uv = params?.uv ?? attribute('uv');

  return texture(colorMap, frameUv(texCoords, uv, params?.flipDiagonal));
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
