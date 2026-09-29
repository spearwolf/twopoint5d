import {createSandbox} from 'sinon';
import {FloatType, HalfFloatType, RenderTarget, type TextureDataType} from 'three/webgpu';
import {afterEach, describe, expect, it} from 'vitest';
import {StageRenderTargetPool} from './StageRenderTargetPool.js';

const NOT_ON_LOAN = 'StageRenderTargetPool#release() cannot take the render target back: it is not on loan from this pool';
const DISPOSED = 'StageRenderTargetPool#acquire() is not available: this pool has been disposed';

describe('StageRenderTargetPool', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('acquire() builds a target of the width, the height, the type and the samples it is asked for', () => {
    const pool = new StageRenderTargetPool();

    const rt = pool.acquire(200, 100, FloatType, 4);

    expect(rt.isRenderTarget).toBe(true);
    expect([rt.width, rt.height]).toEqual([200, 100]);
    expect(rt.texture.type).toBe(FloatType);
    expect(rt.samples).toBe(4);
  });

  it('lends a target that is back to the next acquire() of the same size, type and samples', () => {
    const pool = new StageRenderTargetPool();
    const rt = pool.acquire(200, 100, FloatType, 4);
    pool.release(rt);

    expect(pool.acquire(200, 100, FloatType, 4)).toBe(rt);
  });

  it('lends a second target while the first is out', () => {
    const pool = new StageRenderTargetPool();
    const first = pool.acquire(200, 100, FloatType, 4);
    const second = pool.acquire(200, 100, FloatType, 4);

    expect(second).not.toBe(first);

    pool.release(first);
    pool.release(second);

    expect(pool.acquire(200, 100, FloatType, 4), 'the first one built').toBe(first);
    expect(pool.acquire(200, 100, FloatType, 4), 'the second one built').toBe(second);
  });

  const other: [string, [number, number, TextureDataType, number]][] = [
    ['width', [300, 100, FloatType, 4]],
    ['height', [200, 150, FloatType, 4]],
    ['type', [200, 100, HalfFloatType, 4]],
    ['samples', [200, 100, FloatType, 0]],
  ];

  for (const [what, args] of other) {
    it(`builds a new target for another ${what} and releases the free ones first`, () => {
      const pool = new StageRenderTargetPool();
      const old = pool.acquire(200, 100, FloatType, 4);
      pool.release(old);
      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

      const rt = pool.acquire(...args);

      expect(rt).not.toBe(old);
      expect([rt.width, rt.height, rt.texture.type, rt.samples]).toEqual(args);
      expect(rtDispose.callCount, 'one release').toBe(1);
      expect(rtDispose.firstCall.thisValue, 'of the free old target').toBe(old);
    });
  }

  it('keeps a target that is out when it builds one of another size', () => {
    const pool = new StageRenderTargetPool();
    const lent = pool.acquire(200, 100, FloatType, 4);
    const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

    const rt = pool.acquire(300, 150, FloatType, 4);

    expect(rt).not.toBe(lent);
    expect(rtDispose.called, 'the lent target stays').toBe(false);

    pool.release(lent);
    expect(pool.acquire(200, 100, FloatType, 4), 'lent again once it is back').toBe(lent);
  });

  it('release() refuses a render target it has not lent out', () => {
    const pool = new StageRenderTargetPool();

    expect(() => pool.release(new RenderTarget()), 'a target of nobody').toThrow(NOT_ON_LOAN);

    const rt = pool.acquire(200, 100, FloatType, 4);
    pool.release(rt);
    expect(() => pool.release(rt), 'a target that is back already').toThrow(NOT_ON_LOAN);
  });

  describe('dispose()', () => {
    // (a) a resource the instance built itself is released exactly once
    it('disposes every target that is back in the pool, once', () => {
      const pool = new StageRenderTargetPool();
      const a = pool.acquire(200, 100, FloatType, 4);
      const b = pool.acquire(200, 100, FloatType, 4);
      pool.release(a);
      pool.release(b);
      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

      pool.dispose();

      expect(rtDispose.callCount).toBe(2);
      expect(rtDispose.getCalls().map((call) => call.thisValue)).toEqual([a, b]);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    it('behaves as documented after dispose()', () => {
      const pool = new StageRenderTargetPool();
      const lent = pool.acquire(200, 100, FloatType, 4);
      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

      pool.dispose();

      expect(pool.isDisposed).toBe(true);
      expect(() => pool.acquire(200, 100, FloatType, 4)).toThrow(DISPOSED);
      expect(rtDispose.called, 'the lent target stays until it comes back').toBe(false);

      pool.release(lent);
      expect(rtDispose.callCount, 'released once as it comes back').toBe(1);
      expect(rtDispose.firstCall.thisValue).toBe(lent);

      expect(() => pool.release(lent), 'a second return').toThrow(NOT_ON_LOAN);
      expect(rtDispose.callCount).toBe(1);
    });

    // (d) the second call throws nothing and releases nothing a second time
    it('is safe to call twice', () => {
      const pool = new StageRenderTargetPool();
      pool.release(pool.acquire(200, 100, FloatType, 4));
      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

      expect(() => {
        pool.dispose();
        pool.dispose();
      }).not.toThrow();

      expect(rtDispose.callCount).toBe(1);
    });

    // (b) has no subject here: the pool takes nothing in. (e) neither: it creates no signals and
    // no effects. (f) neither: it borrows from no pool, it is the pool.
  });
});
