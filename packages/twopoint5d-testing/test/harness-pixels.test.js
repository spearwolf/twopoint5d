/** @import {RenderTarget, WebGPURenderer} from 'three/webgpu' */
import {FeatureSprites} from '@spearwolf/twopoint5d';
import {expect} from 'chai';
import {readsTopDown, readTargetPixels} from './helpers/fixtures.js';

// The pixel helpers of the fixtures release what they build when a render throws, and refuse a
// read-back they would read wrong. This file checks that with stub renderers instead of real
// ones: it renders nothing.

/**
 * @param {unknown} stub
 * @returns {WebGPURenderer}
 */
const asRenderer = (stub) => /** @type {WebGPURenderer} */ (/** @type {unknown} */ (stub));

describe('readsTopDown()', function () {
  it('releases its probe sprites when the render throws', async () => {
    const failure = new Error('the render of the stub');
    const stub = {
      setClearColor() {},
      setRenderTarget() {},
      render() {
        throw failure;
      },
      readRenderTargetPixelsAsync() {
        throw new Error('the read-back must not be reached after a render that threw');
      },
    };
    const target = /** @type {RenderTarget} */ (/** @type {unknown} */ ({width: 64, height: 64}));

    const original = FeatureSprites.prototype.dispose;
    let disposed = 0;
    FeatureSprites.prototype.dispose = function () {
      disposed++;
      return original.call(this);
    };
    try {
      let thrown;
      try {
        await readsTopDown(asRenderer(stub), target);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, 'the error readsTopDown() rejects with').to.equal(failure);
      expect(disposed, 'calls of dispose() on the probe sprites').to.equal(1);
    } finally {
      FeatureSprites.prototype.dispose = original;
    }
  });
});

describe('readTargetPixels()', function () {
  /**
   * @param {number} width
   * @param {number} height
   * @param {ArrayBufferView} pixels
   */
  const read = (width, height, pixels) => {
    const stub = {readRenderTargetPixelsAsync: async () => pixels};
    const target = /** @type {RenderTarget} */ (/** @type {unknown} */ ({width, height}));
    return readTargetPixels(asRenderer(stub), target);
  };

  it('refuses a read-back whose rows a backend has padded', async () => {
    let thrown;
    try {
      await read(50, 50, new Uint8Array(256 * 50));
    } catch (error) {
      thrown = error;
    }
    expect(thrown, 'the rejection').to.be.instanceOf(Error);
    expect(thrown.message).to.match(/^readTargetPixels\(\): /);
    expect(thrown.message).to.include('50 × 50').and.include('12800').and.include('10000');
  });

  it('refuses a read-back of another format', async () => {
    let thrown;
    try {
      await read(64, 64, new Uint16Array(64 * 64 * 4));
    } catch (error) {
      thrown = error;
    }
    expect(thrown, 'the rejection').to.be.instanceOf(Error);
    expect(thrown.message)
      .to.match(/^readTargetPixels\(\): /)
      .and.include('Uint16Array');
  });

  it('hands on a read-back packed tightly', async () => {
    const pixels = new Uint8Array(64 * 64 * 4);
    expect(await read(64, 64, pixels)).to.equal(pixels);
  });
});
