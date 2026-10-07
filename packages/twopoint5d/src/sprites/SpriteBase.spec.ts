import {describe, expect, test} from 'vitest';

import {VertexObjectPool} from '../vertex-objects/VertexObjectPool.js';
import {QuadBase, type QuadBaseVO} from './SpriteBase.js';

describe('QuadBase', () => {
  const makeQuad = (...args: Parameters<QuadBaseVO['make']>) => {
    const pool = new VertexObjectPool<QuadBaseVO>(QuadBase.description, 1);
    const quad = pool.createVO()!;
    quad.make(...args);
    return {pool, quad};
  };

  test('is four vertices drawn as two triangles, with a position of 3 and a uv of 2 values', () => {
    expect(QuadBase.name).toBe('quad');
    expect(QuadBase.description.vertexCount).toBe(4);
    expect(QuadBase.description.indices).toEqual([0, 2, 1, 0, 3, 2]);
    expect(QuadBase.description.attributes['position']).toEqual({components: ['x', 'y', 'z']});
    expect(QuadBase.description.attributes['uv']).toEqual({components: ['u', 'v']});
    expect(QuadBase.defaultArgs).toEqual([0.5, 0.5]);
  });

  test('makes the unit quad around the origin from its default arguments, uv (0,0) at the top left', () => {
    const {pool, quad} = makeQuad(...QuadBase.defaultArgs);

    expect([quad.x0, quad.y0, quad.x1, quad.y1, quad.x2, quad.y2, quad.x3, quad.y3]).toEqual([
      -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    ]);
    expect([quad.z0, quad.z1, quad.z2, quad.z3]).toEqual([0, 0, 0, 0]);
    expect([quad.u0, quad.v0, quad.u1, quad.v1, quad.u2, quad.v2, quad.u3, quad.v3]).toEqual([0, 1, 0, 0, 1, 0, 1, 1]);

    pool.dispose();
  });

  test('makes the quad from the half measures and the offset it is given', () => {
    const {pool, quad} = makeQuad(2, 3, 1, 1);

    expect([quad.x0, quad.y0, quad.x1, quad.y1, quad.x2, quad.y2, quad.x3, quad.y3]).toEqual([-1, -2, -1, 4, 3, 4, 3, -2]);

    pool.dispose();
  });

  test('makes the unit quad when called without arguments', () => {
    const {pool, quad} = makeQuad();

    expect([quad.x0, quad.y0, quad.x2, quad.y2]).toEqual([-0.5, -0.5, 0.5, 0.5]);

    pool.dispose();
  });
});
