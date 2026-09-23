import {describe, expect, test} from 'vitest';
import {GeometryRoutes} from './GeometryRoutes.js';
import {VOBufferPool} from './VOBufferPool.js';

describe('GeometryRoutes', () => {
  const makePool = () => new VOBufferPool({attributes: {v: {size: 1}}}, 1);

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
});
