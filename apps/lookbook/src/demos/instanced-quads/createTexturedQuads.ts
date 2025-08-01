import {colorFromTextureByTexCoords, vertexByInstancePosition, VertexObjectPool, VertexObjects} from '@spearwolf/twopoint5d';
import {attribute, vec3} from 'three/tsl';
import {NodeMaterial, type Texture} from 'three/webgpu';
import {InstancedQuadsGeometry, type InstancedQuad} from './InstancedQuadsGeometry';

const createMaterial = (texture: Texture, material = new NodeMaterial()) => {
  material.positionNode = vertexByInstancePosition({scale: vec3(attribute('quadSize'), 1.0)});
  material.colorNode = colorFromTextureByTexCoords(texture);
  return material;
};

export const createTexturedQuads = (
  {capacity, texture, material}: {capacity: number; texture: Texture; material?: NodeMaterial},
  initializeVertexObjects: (vertexObjectPool: VertexObjectPool<InstancedQuad>) => void,
) => {
  const geometry = new InstancedQuadsGeometry(capacity);
  geometry.basePool.createVO().make();

  initializeVertexObjects(geometry.instancedPool);

  const mesh = new VertexObjects(geometry, createMaterial(texture, material));

  mesh.name = 'TexturedQuadsMesh';

  mesh.update();

  return mesh;
};
