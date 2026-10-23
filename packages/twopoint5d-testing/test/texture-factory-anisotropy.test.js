import {expect} from '@esm-bundle/chai';
import {TextureFactory} from '@spearwolf/twopoint5d';
import {Texture, WebGPURenderer} from 'three/webgpu';

describe('TextureFactory — anisotropic filtering against a real renderer', function () {
  /** @type {WebGPURenderer | undefined} */
  let renderer;

  beforeEach(async () => {
    renderer = new WebGPURenderer();
    document.body.appendChild(renderer.domElement);
    await renderer.init();
  });

  afterEach(async () => {
    if (renderer) {
      // awaited: WebGLBackend.dispose() gives its context up only after an await of its own, and
      // the next beforeEach would otherwise ask for a new one while the old is still alive —
      // headless Firefox on llvmpipe then fails the getContext('webgl2') now and again
      await renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    renderer = undefined;
  });

  it('the open class takes the maximum the hardware names', () => {
    const factory = new TextureFactory(renderer, []);

    const texture = factory.update(new Texture(), 'anisotropy');

    expect(texture.anisotropy, 'the anisotropy three.js will build the sampler with').to.equal(
      Math.max(1, renderer.getMaxAnisotropy()),
    );
  });

  it('a fixed class is capped against that maximum', () => {
    const factory = new TextureFactory(renderer, []);

    const texture = factory.update(new Texture(), 'anisotropy-4');

    expect(texture.anisotropy, 'the anisotropy three.js will build the sampler with').to.equal(
      Math.min(4, Math.max(1, renderer.getMaxAnisotropy())),
    );
    expect(texture).to.not.have.own.property('anisotrophy');
  });
});

describe('TextureFactory — built before the renderer is initialized', function () {
  it('a factory built before init() of a WebGL backend caps against the maximum that backend names after it', async () => {
    // forceWebGL: a WebGL backend from the start names no maximum before init(). A plain
    // WebGPURenderer starts on the WebGPU backend even where the harness takes WebGPU away, and that
    // backend names 16 before init()
    const renderer = new WebGPURenderer({forceWebGL: true});
    document.body.appendChild(renderer.domElement);
    try {
      const factory = new TextureFactory(renderer, []);

      await renderer.init();

      const texture = factory.update(new Texture(), 'anisotropy');

      expect(texture.anisotropy, 'the anisotropy three.js will build the sampler with').to.equal(
        Math.max(1, renderer.getMaxAnisotropy()),
      );
    } finally {
      // awaited, as in the afterEach above: the context is given up only after an await of its own
      await renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
  });
});
