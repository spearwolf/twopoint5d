import {describe, expect, test} from 'vitest';
import {GeometryRoutes} from './GeometryRoutes.js';
import {VOBufferPool} from './VOBufferPool.js';
import {VertexObjectPool} from './VertexObjectPool.js';

describe('GeometryRoutes', () => {
  const makePool = () => new VertexObjectPool({attributes: {v: {size: 1}}}, 1);

  test('attach() throws for a name that already has a route and keeps that route', () => {
    const routes = new GeometryRoutes();
    const first = {pool: makePool(), buffers: new Map(), bufferSerials: new Map(), group: 'instanced' as const};
    const second = {pool: makePool(), buffers: new Map(), bufferSerials: new Map(), group: 'instanced' as const};

    routes.attach({...first, name: 'a'});

    expect(() => routes.attach({...second, name: 'a'})).toThrow(
      'GeometryRoutes#attach(): the name "a" already has a route — detach it first',
    );

    expect(routes.route('a')).toEqual({...first, name: 'a', firstAutoTouch: true});
  });

  test('attach() takes a VertexObjectPool and refuses a VOBufferPool at compile time', () => {
    const routes = new GeometryRoutes();
    const pool = new VOBufferPool({attributes: {v: {size: 1}}}, 1);

    expect(() =>
      routes.attach({
        name: 'a',
        // @ts-expect-error a named route is fed from a VertexObjectPool
        pool,
        buffers: new Map(),
        bufferSerials: new Map(),
        group: 'instanced',
      }),
    ).not.toThrow();
  });
});
