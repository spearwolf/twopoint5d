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

  afterEach(() => {
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    renderer = undefined;
  });

  it('the open class takes the maximum the hardware names', () => {
    const factory = new TextureFactory(renderer, []);

    const texture = factory.update(new Texture(), 'anisotrophy');

    expect(texture.anisotropy, 'the anisotropy three.js will build the sampler with').to.equal(
      Math.max(1, renderer.getMaxAnisotropy()),
    );
  });

  it('a fixed class is capped against that maximum', () => {
    const factory = new TextureFactory(renderer, []);

    const texture = factory.update(new Texture(), 'anisotrophy-4');

    expect(texture.anisotropy, 'the anisotropy three.js will build the sampler with').to.equal(
      Math.min(4, Math.max(1, renderer.getMaxAnisotropy())),
    );
    expect(texture).to.not.have.own.property('anisotrophy');
  });
});
