import {expect} from '@esm-bundle/chai';
import {TextureFactory} from '@spearwolf/twopoint5d';
import {Texture, WebGPURenderer} from 'three/webgpu';

describe('TextureFactory — anisotropic filtering against a real renderer', function () {
  // a cold webgpu start — adapter plus device — is slow
  this.timeout(20000);

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
