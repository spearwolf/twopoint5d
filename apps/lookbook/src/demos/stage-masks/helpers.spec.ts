import {TextureCoords} from '@spearwolf/twopoint5d';
import {BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry} from 'three/webgpu';
import {describe, expect, it} from 'vitest';
import {MeshBundle, setPlaneUvToFrame, smoothstepCpu} from './helpers';

const texture = new TextureCoords(0, 0, 256, 256);
const frameA = new TextureCoords(texture, 0, 0, 64, 32);
const frameB = new TextureCoords(texture, 128, 64, 32, 96);

/** the uv attribute of a plane, which a PlaneGeometry builds as a BufferAttribute of its own */
function uvOf(plane: PlaneGeometry): BufferAttribute {
  const uv = plane.getAttribute('uv');
  if (!(uv instanceof BufferAttribute)) throw new Error('the uv of a PlaneGeometry is no BufferAttribute');
  return uv;
}

describe('setPlaneUvToFrame', () => {
  it('maps the corners of the plane upright onto the frame', () => {
    const plane = new PlaneGeometry(1, 1, 1, 2);
    setPlaneUvToFrame(plane, frameB);
    const [s, t, u, v] = frameB.getTexCoords();
    const uv = uvOf(plane);
    // the first vertex of a PlaneGeometry is its top left corner, the last its bottom right one
    expect(uv.getX(0)).toBeCloseTo(s, 12);
    expect(uv.getY(0)).toBeCloseTo(t, 12);
    expect(uv.getX(uv.count - 1)).toBeCloseTo(s + u, 12);
    expect(uv.getY(uv.count - 1)).toBeCloseTo(t + v, 12);
  });

  it('marks the uv for an upload', () => {
    const plane = new PlaneGeometry(1, 1, 1, 2);
    const uv = uvOf(plane);
    const version = uv.version;
    setPlaneUvToFrame(plane, frameA);
    expect(uv.version).toBeGreaterThan(version);
  });

  it('maps a plane to a second frame from the uv it was built with, not from the first frame', () => {
    const plane = new PlaneGeometry(1, 1, 1, 2);
    setPlaneUvToFrame(plane, frameA);
    setPlaneUvToFrame(plane, frameB);

    const fresh = new PlaneGeometry(1, 1, 1, 2);
    setPlaneUvToFrame(fresh, frameB);

    expect(Array.from(uvOf(plane).array)).toEqual(Array.from(uvOf(fresh).array));
  });
});

describe('smoothstepCpu', () => {
  it('is 0 up to e0, 1 from e1 on and 0.5 in the middle', () => {
    expect(smoothstepCpu(2, 4, 1)).toBe(0);
    expect(smoothstepCpu(2, 4, 2)).toBe(0);
    expect(smoothstepCpu(2, 4, 3)).toBe(0.5);
    expect(smoothstepCpu(2, 4, 4)).toBe(1);
    expect(smoothstepCpu(2, 4, 9)).toBe(1);
  });
});

describe('MeshBundle', () => {
  /** a mesh that counts the dispose events of its geometry and its material */
  function countedMesh() {
    const mesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial());
    const disposed = {geometry: 0, material: 0};
    mesh.geometry.addEventListener('dispose', () => disposed.geometry++);
    mesh.material.addEventListener('dispose', () => disposed.material++);
    return {mesh, disposed};
  }

  it('adds a mesh to its parent under its name, at x and y on the plane, in its render order', () => {
    const parent = new Group();
    const {mesh} = countedMesh();

    expect(new MeshBundle(parent).add(mesh, 'moth', 3, -4, 2)).toBe(mesh);

    expect(parent.children).toContain(mesh);
    expect(mesh.name).toBe('moth');
    expect(mesh.position.toArray()).toEqual([3, -4, 0]);
    expect(mesh.renderOrder).toBe(2);
  });

  it('puts a mesh at the origin in render order 0 when no place is given', () => {
    const {mesh} = countedMesh();
    mesh.position.set(5, 6, 7);
    mesh.renderOrder = 9;

    new MeshBundle(new Group()).add(mesh, 'void');

    expect(mesh.position.toArray()).toEqual([0, 0, 0]);
    expect(mesh.renderOrder).toBe(0);
  });

  it('disposes the geometry and the material of every mesh it added, once', () => {
    const bundle = new MeshBundle(new Group());
    const first = countedMesh();
    const second = countedMesh();
    bundle.add(first.mesh, 'first');
    bundle.add(second.mesh, 'second');

    bundle.dispose();
    bundle.dispose();

    expect(first.disposed).toEqual({geometry: 1, material: 1});
    expect(second.disposed).toEqual({geometry: 1, material: 1});
  });
});
