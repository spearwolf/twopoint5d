import {expect} from '@esm-bundle/chai';
import {Display, InstancedVertexObjectGeometry, VertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
import {attribute, float, vec3} from 'three/tsl';
import {MeshBasicMaterial, MeshBasicNodeMaterial, PerspectiveCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  makeContainer,
  disposeDisplay,
  bufferOf,
  readBack,
  quadDescription,
  instancedDescription,
  renderToPixels,
  rgbAt,
  isNearColor,
} from './helpers/fixtures.js';

/** @import {VO, VOAttrSetter, VOBufferGeometry, VertexObjectDescription} from '@spearwolf/twopoint5d' */
/** @typedef {VO & {setPosition: VOAttrSetter}} QuadVO */
/** @typedef {VO & {setInstanceOffset: VOAttrSetter}} InstanceVO */
/** @typedef {VO & {setPosition: VOAttrSetter, setColor: VOAttrSetter}} ColoredQuadVO */
/** @typedef {VO & {setPosition: VOAttrSetter, setBase: VOAttrSetter, setTint: VOAttrSetter}} TintedQuadVO */
/** @typedef {VO & {setPosition: VOAttrSetter, setDx: VOAttrSetter, setDy: VOAttrSetter}} OffsetQuadVO */
/** @typedef {VO & {setPosition: VOAttrSetter, setLevel: VOAttrSetter}} LevelQuadVO */
/** @typedef {VO & {setPosition: VOAttrSetter, setBytes: VOAttrSetter}} ByteQuadVO */

/**
 * Reads an interleaved attribute back out of the gpu buffer it shares with its siblings.
 *
 * On the WebGL backend three 0.186.1 answers an empty buffer for it: in
 * `src/renderers/webgl-fallback/utils/WebGLAttributeUtils.js`, `createAttribute()` files the
 * record that carries `byteLength` under the attribute wrapper, while `getArrayBufferAsync()`
 * looks it up under the shared buffer, `attribute.data`. The gl buffer is read directly
 * instead; the WebGPU backend takes the usual path.
 *
 * "three still reads an interleaved attribute back as an empty buffer on the WebGL backend"
 * fails once a three release reads the whole buffer back — this helper and that test go then.
 */
async function readBackInterleaved(display, attr) {
  if (display.isWebGPUBackend) return readBack(display.renderer, attr);

  const {gl} = display.renderer.backend;
  const buffer = bufferOf(attr);
  const out = new Float32Array(buffer.array.length);
  const previous = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  try {
    gl.bindBuffer(gl.ARRAY_BUFFER, display.renderer.backend.get(buffer).bufferGPU);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out);
  } finally {
    gl.bindBuffer(gl.ARRAY_BUFFER, previous);
  }
  return Array.from(out);
}

// static and therefore without autoTouch: what reaches the gpu here comes from the pool having
// written something, which is the whole point of this test
/** @type {VertexObjectDescription} */
const staticQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'static'}},
};

// one quad per object, side by side along x, so every object carries values of its own
const quadAt = (i) => [i, 0, 0, i + 1, 0, 0, i + 1, 1, 0, i, 1, 0];

// both attributes share the buffer name `dynamic_float32`, so they interleave into one buffer of stride 6
/** @type {VertexObjectDescription} */
const interleavedQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {
    position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'},
    color: {components: ['r', 'g', 'b'], type: 'float32', usage: 'dynamic'},
  },
};

// `base` and `tint` agree on type, usage and normalized, so both land in one buffer, where each of
// the two takes three bytes and one of padding per vertex; `glow` has a buffer of its own, in which
// its three bytes and one of padding are all a vertex takes
/** @type {VertexObjectDescription} */
const tintedQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {
    position: {components: ['x', 'y', 'z'], type: 'float32'},
    base: {components: ['baseR', 'baseG', 'baseB'], type: 'uint8', normalized: true},
    tint: {components: ['tintR', 'tintG', 'tintB'], type: 'uint8', normalized: true},
    glow: {size: 3, type: 'uint8', normalized: true, bufferName: 'glow'},
  },
};

// `dx` and `dy` are int16 attributes of one value that share a buffer, `level` a uint16 attribute
// of one value alone in its buffer: three builds no vertex format of one value for either type, so
// the descriptor lays all three out as 32-bit integers
/** @type {VertexObjectDescription} */
const offsetQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {
    position: {components: ['x', 'y', 'z'], type: 'float32'},
    dx: {size: 1, type: 'int16', bufferName: 'offsets'},
    dy: {size: 1, type: 'int16', bufferName: 'offsets'},
  },
};

// four bytes without `normalized` alone in their buffer: three widens such an array to 32 bits as
// a BufferAttribute and leaves it as it is as an InterleavedBuffer, which is how the geometry hands
// it over
/** @type {VertexObjectDescription} */
const byteQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {
    position: {components: ['x', 'y', 'z'], type: 'float32'},
    bytes: {size: 4, type: 'uint8'},
  },
};

/** @type {VertexObjectDescription} */
const levelQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {
    position: {components: ['x', 'y', 'z'], type: 'float32'},
    level: {size: 1, type: 'uint16'},
  },
};

/**
 * Every attribute of `geometry` still draws from the array its pool holds for it: nothing was
 * copied or widened on the way to the gpu.
 *
 * @param {VOBufferGeometry} geometry
 */
function expectPoolArrays(geometry) {
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const {bufferName} = geometry.pool.buffer.bufferAttributes.get(name);
    expect(bufferOf(attr).array === geometry.pool.buffer.buffers.get(bufferName).typedArray, `the array of ${name}`).to.equal(
      true,
    );
  }
}

// a width of 64 pixels keeps the rows rgbAt() reads unpadded
const TARGET_SIZE = 64;

describe('vertex-objects — gpu upload', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  let scene;
  let camera;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    console.debug(`Display: backend is ${display.isWebGPUBackend ? 'WebGPU' : 'WebGL'}`);
    scene = new Scene();
    camera = new PerspectiveCamera(75, 1.6, 0.1, 100);
    camera.position.z = 5;
  });

  afterEach(() => {
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  it('every vertex of a used object reaches the gpu, not just the first', async function () {
    /** @type {VertexObjectGeometry<QuadVO>} */
    const geometry = new VertexObjectGeometry(quadDescription, 8);
    const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');

    // rewrite the tail of the very same object: only vertex 0 keeps the values it had
    quad.setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
    mesh.update();

    // itemSize (3) * vertexCount (4) * usedCount (1) — a range of 3 would carry vertex 0 alone
    expect(bufferOf(position).updateRanges).to.deep.equal([{start: 0, count: 12}]);

    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect((await readBack(display.renderer, position)).slice(0, 12)).to.deep.equal([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
  });

  it('a spawn in a large, mostly static pool uploads the new object alone', async function () {
    /** @type {VertexObjectGeometry<QuadVO>} */
    const geometry = new VertexObjectGeometry(staticQuadDescription, 64);
    const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
    scene.add(mesh);

    for (let i = 0; i < 32; i++) {
      geometry.pool.createVO().setPosition(quadAt(i));
    }

    // this pass spends the auto-touch round that uploads a static buffer once in full; from here
    // on the upload hangs on the pool having written something
    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');

    // the pass above built the gpu buffer out of the whole array and left its range standing —
    // three takes a range up only on an upload that follows one. This spawn is that upload, and
    // the pool is in its steady state afterwards, which is where a sprite spawn really happens
    geometry.pool.createVO().setPosition(quadAt(100));
    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    geometry.pool.createVO().setPosition(quadAt(200));
    mesh.update();

    // the 34th object and nothing else: 4 vertices of 3 components, at object 33
    expect(bufferOf(position).updateRanges).to.deep.equal([{start: 33 * 4 * 3, count: 4 * 3}]);

    display.renderer.render(scene, camera);
    await display.nextFrame();

    const onTheGpu = await readBack(display.renderer, position);

    expect(onTheGpu.slice(33 * 12, 34 * 12), 'the object that was spawned').to.deep.equal(quadAt(200));
    expect(onTheGpu.slice(32 * 12, 33 * 12), 'the object of the spawn before it').to.deep.equal(quadAt(100));
    expect(onTheGpu.slice(5 * 12, 6 * 12), 'an object that nobody touched').to.deep.equal(quadAt(5));
  });

  it('freeing an object in the middle and spawning one uploads both slots and nothing between them', async function () {
    /** @type {VertexObjectGeometry<QuadVO>} */
    const geometry = new VertexObjectGeometry(staticQuadDescription, 64);
    const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
    scene.add(mesh);

    for (let i = 0; i < 32; i++) {
      geometry.pool.createVO().setPosition(quadAt(i));
    }

    // the first pass spends the auto-touch round and builds the gpu buffer out of the whole array;
    // the spawn after it is the upload that takes that range up, and no range stands afterwards
    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    geometry.pool.createVO().setPosition(quadAt(100));
    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');

    // the object of slot 32 moves down into slot 3, and the spawn takes slot 32 again
    geometry.pool.freeVO(geometry.pool.getVO(3));
    geometry.pool.createVO().setPosition(quadAt(200));
    mesh.update();

    // slot 3 and slot 32, 4 vertices of 3 components each, and none of the 28 objects between them
    expect(bufferOf(position).updateRanges).to.deep.equal([
      {start: 3 * 4 * 3, count: 4 * 3},
      {start: 32 * 4 * 3, count: 4 * 3},
    ]);

    display.renderer.render(scene, camera);
    await display.nextFrame();

    const onTheGpu = await readBack(display.renderer, position);

    expect(onTheGpu.slice(3 * 12, 4 * 12), 'the object that moved into the freed slot').to.deep.equal(quadAt(100));
    expect(onTheGpu.slice(32 * 12, 33 * 12), 'the object that was spawned').to.deep.equal(quadAt(200));
    expect(onTheGpu.slice(5 * 12, 6 * 12), 'an object that nobody touched').to.deep.equal(quadAt(5));
  });

  it('an instanced geometry uploads its base quad and every used instance', async function () {
    /** @type {InstancedVertexObjectGeometry<InstanceVO, QuadVO>} */
    const geometry = new InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1);
    const material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', /** @type {const} */ ('vec3')).add(attribute('instanceOffset', 'vec3'));
    const mesh = new VertexObjects(geometry, material);
    scene.add(mesh);

    const quad = geometry.basePool.createVO();
    quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    geometry.instancedPool.createVO().setInstanceOffset([1, 1, 1]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');
    const instanceOffset = geometry.getAttribute('instanceOffset');

    quad.setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
    for (let i = 1; i < 4; i++) {
      geometry.instancedPool.createVO().setInstanceOffset([i * 10, i * 10, i * 10]);
    }

    mesh.update();

    // the base pool counts vertices per object, the instanced pool counts instances
    expect(bufferOf(position).updateRanges, 'base pool').to.deep.equal([{start: 0, count: 12}]);
    expect(bufferOf(instanceOffset).updateRanges, 'instanced pool').to.deep.equal([{start: 0, count: 12}]);

    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect((await readBack(display.renderer, position)).slice(0, 12), 'base quad').to.deep.equal([
      0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9,
    ]);
    expect((await readBack(display.renderer, instanceOffset)).slice(0, 12), 'instances').to.deep.equal([
      1, 1, 1, 10, 10, 10, 20, 20, 20, 30, 30, 30,
    ]);
  });

  it('an object whose indices leave a vertex unused is drawn from its own vertices', async function () {
    // four vertices per object, of which the indices name three: the second object starts at vertex 4
    /** @type {VertexObjectDescription} */
    const description = {
      vertexCount: 4,
      indices: [0, 1, 2],
      attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
    };
    /** @type {VertexObjectGeometry<QuadVO>} */
    const geometry = new VertexObjectGeometry(description, 2);
    const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
    scene.add(mesh);

    geometry.pool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 9, 9, 9]);
    geometry.pool.createVO().setPosition([2, 0, 0, 3, 0, 0, 3, 1, 0, 9, 9, 9]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const indices = Array.from(new Uint32Array(await display.renderer.getArrayBufferAsync(geometry.index)));

    expect(indices.slice(0, 6)).to.deep.equal([0, 1, 2, 4, 5, 6]);
  });

  it('two attributes that share a buffer upload the whole stride of every used vertex', async function () {
    /** @type {VertexObjectGeometry<ColoredQuadVO>} */
    const geometry = new VertexObjectGeometry(interleavedQuadDescription, 8);
    const material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', 'vec3');
    material.colorNode = attribute('color', 'vec3');
    const mesh = new VertexObjects(geometry, material);
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    quad.setColor([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');

    expect(bufferOf(position), 'one interleaved buffer carries both attributes').to.equal(bufferOf(color));

    // rewrite both attributes of the very same object
    quad.setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
    quad.setColor([2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
    mesh.update();

    // itemSize (6, the stride) * vertexCount (4) * usedCount (1) — a range of 12 would ignore the stride
    expect(bufferOf(position).updateRanges).to.deep.equal([{start: 0, count: 24}]);

    display.renderer.render(scene, camera);
    await display.nextFrame();

    // the attributes sit in alphabetical order inside the stride: color at offset 0, position at offset 3
    expect((await readBackInterleaved(display, position)).slice(0, 24)).to.deep.equal([
      2, 2, 2, 0, 0, 0, 3, 3, 3, 7, 7, 7, 4, 4, 4, 8, 8, 8, 5, 5, 5, 9, 9, 9,
    ]);
  });

  it('two attributes of three normalized bytes that share a buffer are each drawn from their own four bytes', async function () {
    /** @type {VertexObjectGeometry<TintedQuadVO>} */
    const geometry = new VertexObjectGeometry(tintedQuadDescription, 1);
    const material = new MeshBasicNodeMaterial();
    // red out of `base`, green out of `tint`: a tint read at the offset of an unpadded layout
    // would take the padding and the first two bytes of the tint instead. Blue out of `glow`, which
    // stays 0 — read only so that three builds a gpu buffer for it
    material.colorNode = vec3(
      attribute('base', /** @type {const} */ ('vec3')).x,
      attribute('tint', /** @type {const} */ ('vec3')).y,
      attribute('glow', /** @type {const} */ ('vec3')).z,
    );
    const mesh = new VertexObjects(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    // a quad far wider than the view, so the pixel in the middle of the target is one of its own
    quad.setPosition([-10, -10, 0, 10, -10, 0, 10, 10, 0, -10, 10, 0]);
    quad.setBase([255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0]);
    quad.setTint([0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0]);
    mesh.update();

    const target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
    try {
      const pixels = await renderToPixels(display.renderer, scene, camera, target);
      const middle = rgbAt(pixels, TARGET_SIZE, TARGET_SIZE / 2, TARGET_SIZE / 2);

      expect(isNearColor(middle, [255, 255, 0]), `the pixel in the middle is [${middle}]`).to.equal(true);
    } finally {
      target.dispose();
    }

    if (display.isWebGPUBackend) {
      // three pads a buffer attribute whose stride is no multiple of 4 bytes, and does it again on
      // every update; `glow` alone in its buffer is the attribute that would be one, and a buffer
      // three padded carries `_paddedItemSize`
      const backend = /** @type {{get(object: object): {_paddedItemSize?: number}}} */ (
        /** @type {unknown} */ (display.renderer.backend)
      );
      expect(backend.get(bufferOf(geometry.getAttribute('glow')))._paddedItemSize).to.equal(undefined);
    }
  });

  it('two int16 attributes of one value that share a buffer are each drawn with their own value and sign', async function () {
    /** @type {VertexObjectGeometry<OffsetQuadVO>} */
    const geometry = new VertexObjectGeometry(offsetQuadDescription, 1);
    const material = new MeshBasicNodeMaterial();
    // red out of `dx`, green out of the negated `dy`: a sign lost on the way reads as 0
    material.colorNode = vec3(
      float(attribute('dx', /** @type {const} */ ('int'))).div(255),
      float(attribute('dy', /** @type {const} */ ('int')))
        .negate()
        .div(255),
      0,
    );
    const mesh = new VertexObjects(geometry, material);
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    quad.setPosition([-10, -10, 0, 10, -10, 0, 10, 10, 0, -10, 10, 0]);
    quad.setDx([200, 200, 200, 200]);
    quad.setDy([-100, -100, -100, -100]);
    mesh.update();

    const target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
    try {
      const pixels = await renderToPixels(display.renderer, scene, camera, target);
      const middle = rgbAt(pixels, TARGET_SIZE, TARGET_SIZE / 2, TARGET_SIZE / 2);

      expect(isNearColor(middle, [200, 100, 0]), `the pixel in the middle is [${middle}]`).to.equal(true);
    } finally {
      target.dispose();
    }
    expectPoolArrays(geometry);
  });

  it('a uint16 attribute of one value alone in its buffer is drawn with its value', async function () {
    /** @type {VertexObjectGeometry<LevelQuadVO>} */
    const geometry = new VertexObjectGeometry(levelQuadDescription, 1);
    const material = new MeshBasicNodeMaterial();
    material.colorNode = vec3(float(attribute('level', /** @type {const} */ ('uint'))).div(255), 0, 0);
    const mesh = new VertexObjects(geometry, material);
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    quad.setPosition([-10, -10, 0, 10, -10, 0, 10, 10, 0, -10, 10, 0]);
    quad.setLevel([200, 200, 200, 200]);
    mesh.update();

    const target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
    try {
      const pixels = await renderToPixels(display.renderer, scene, camera, target);
      const middle = rgbAt(pixels, TARGET_SIZE, TARGET_SIZE / 2, TARGET_SIZE / 2);

      expect(isNearColor(middle, [200, 0, 0]), `the pixel in the middle is [${middle}]`).to.equal(true);
    } finally {
      target.dispose();
    }
    expectPoolArrays(geometry);
  });

  it('four bytes without normalized are drawn from the array of the pool', async function () {
    /** @type {VertexObjectGeometry<ByteQuadVO>} */
    const geometry = new VertexObjectGeometry(byteQuadDescription, 1);
    const material = new MeshBasicNodeMaterial();
    // red out of the first byte, green out of the last: a layout read at the wrong width mixes them
    const bytes = attribute('bytes', /** @type {const} */ ('uvec4'));
    material.colorNode = vec3(float(bytes.x).div(255), float(bytes.w).div(255), 0);
    const mesh = new VertexObjects(geometry, material);
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    quad.setPosition([-10, -10, 0, 10, -10, 0, 10, 10, 0, -10, 10, 0]);
    quad.setBytes([200, 1, 2, 100, 200, 1, 2, 100, 200, 1, 2, 100, 200, 1, 2, 100]);
    mesh.update();

    const target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
    try {
      const pixels = await renderToPixels(display.renderer, scene, camera, target);
      const middle = rgbAt(pixels, TARGET_SIZE, TARGET_SIZE / 2, TARGET_SIZE / 2);

      expect(isNearColor(middle, [200, 100, 0]), `the pixel in the middle is [${middle}]`).to.equal(true);
    } finally {
      target.dispose();
    }
    expectPoolArrays(geometry);
  });

  it('three still reads an interleaved attribute back as an empty buffer on the WebGL backend', async function () {
    if (!display.isWebGLBackend) this.skip();

    /** @type {VertexObjectGeometry<ColoredQuadVO>} */
    const geometry = new VertexObjectGeometry(interleavedQuadDescription, 8);
    const material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', 'vec3');
    material.colorNode = attribute('color', 'vec3');
    const mesh = new VertexObjects(geometry, material);
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    quad.setColor([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    /** @type {any} */
    const position = geometry.getAttribute('position');
    const bytes = await display.renderer.getArrayBufferAsync(position);
    expect(
      bytes.byteLength,
      'three reads an interleaved attribute back by itself now: readBackInterleaved() and this test can go',
    ).to.equal(0);
  });
});
