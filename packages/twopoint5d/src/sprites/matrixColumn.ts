import type {Node} from 'three/webgpu';

/**
 * A TSL node is a proxy: `matrix[1]` resolves, once the shader graph is built, to the
 * second column, and the component accessors work on that result. `@types/three@0.183.1`
 * declares the matrix as `Node<'mat4'>` (`src/nodes/accessors/ModelNode.d.ts:39`) without
 * an index signature, so the column itself has no type to travel through.
 *
 * The proxy answers every column, so the array it is read as has no holes and the index
 * carries a `vec4` back out.
 */
export const matrixColumn = (matrix: Node<'mat4'>, column: number): Node<'vec4'> =>
  (matrix as unknown as Node<'vec4'>[])[column] as Node<'vec4'>;
