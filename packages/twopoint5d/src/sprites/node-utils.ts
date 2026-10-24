import {add, attribute, cross, div, float, mul, normalize, sub, texture, vec2} from 'three/tsl';
import type {Node, Texture} from 'three/webgpu';

import {cameraPositionLocal, cameraUpLocal} from './cameraNodes.js';
import {frameUv} from './frameUv.js';

/**
 * Builds the position of a vertex at its instance position: the vertex position — the attribute
 * `position` by default —, multiplied axis by axis by `scale` where one is given, plus the instance
 * position — the attribute `instancePosition` by default. The result lies in the local space of the
 * mesh, which is what a `positionNode` expects; the quad does not turn to the camera, which
 * {@link billboardVertexByInstancePosition} does.
 */
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

/**
 * The uv of the center of texel `ndx` of a texture of `mapSize` texels, the texels counted row by row
 * from texel 0 at the start of the first row.
 */
export const texCoordsFromIndex = (mapSize: Node<'vec2'>, ndx: Node<'int'>) => {
  // The column is worked out in int, from the row: a float modulo divides by the width in f32, and
  // neither WGSL nor GLSL ES rounds that division exactly — at a width that is no power of 2 the
  // quotient tips over to the next whole number, and the column reads the texel of its neighbour.
  const width = mapSize.x.toInt();
  const row = div(ndx, width).toInt();
  const column = sub(ndx, mul(row, width)).toInt();
  return div(add(vec2(column, row), float(0.5)), vec2(mapSize.x, mapSize.y));
};
