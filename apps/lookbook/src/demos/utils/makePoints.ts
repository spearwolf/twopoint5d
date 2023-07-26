import {BufferGeometry, Float32BufferAttribute, PointsMaterial, Points} from 'three';

export function makePoints(vertices: number[], color = 0xf0ff11, size = 4) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));

  const material = new PointsMaterial({color, size});

  return new Points(geometry, material);
}
