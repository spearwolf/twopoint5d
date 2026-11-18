import {BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Scene, Sphere, Sprite} from 'three/webgpu';
import {describe, expect, it} from 'vitest';
import {cullingSphereOf} from './cullingSphere.js';

const HALF_DIAGONAL = Math.sqrt(3) / 2;

const box = () => new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

describe('cullingSphereOf()', () => {
  it('answers an empty sphere for an empty scene', () => {
    const out = new Sphere();
    expect(cullingSphereOf(new Scene(), out)).toBe(out);
    expect(out.isEmpty()).toBe(true);
  });

  it('leaves out a mesh three.js does not cull by its frustum, and one that is not visible', () => {
    const scene = new Scene();
    const unculled = box();
    unculled.frustumCulled = false;
    const hidden = box();
    hidden.visible = false;
    const inHiddenGroup = new Group();
    inHiddenGroup.visible = false;
    inHiddenGroup.add(box());
    scene.add(unculled, hidden, inHiddenGroup);
    expect(cullingSphereOf(scene, new Sphere()).isEmpty()).toBe(true);
  });

  it('takes the sphere three.js culls a sprite by, around its position and grown by its center', () => {
    const scene = new Scene();
    const sprite = new Sprite();
    sprite.position.set(3, 0, 0);
    scene.add(sprite);
    const sphere = cullingSphereOf(scene, new Sphere());
    expect(sphere.center.toArray()).toEqual([3, 0, 0]);
    expect(sphere.radius).toBeCloseTo(Math.SQRT1_2, 12);

    const other = new Scene();
    const offCenter = new Sprite();
    offCenter.center.set(0, 0);
    offCenter.scale.set(2, 2, 1);
    other.add(offCenter);
    const grown = cullingSphereOf(other, new Sphere());
    expect(grown.center.toArray()).toEqual([0, 0, 0]);
    expect(grown.radius).toBeCloseTo(2 * (Math.SQRT1_2 + Math.SQRT1_2), 12);
  });

  it('leaves out a sprite three.js does not cull by its frustum', () => {
    const scene = new Scene();
    const sprite = new Sprite();
    sprite.frustumCulled = false;
    scene.add(sprite);
    expect(cullingSphereOf(scene, new Sphere()).isEmpty()).toBe(true);
  });

  it('answers the union of the spheres of two meshes in a group that is moved, in the world', () => {
    const scene = new Scene();
    const group = new Group();
    group.position.set(10, 0, 0);
    const left = box();
    left.position.set(-1, 0, 0);
    const right = box();
    right.position.set(1, 0, 0);
    group.add(left, right);
    scene.add(group);

    const sphere = cullingSphereOf(scene, new Sphere());
    expect(sphere.center.x).toBeCloseTo(10, 12);
    expect(sphere.center.y).toBeCloseTo(0, 12);
    expect(sphere.center.z).toBeCloseTo(0, 12);
    expect(sphere.radius).toBeCloseTo(1 + HALF_DIAGONAL, 12);
  });

  it('takes the sphere of an InstancedMesh around its instances', () => {
    const scene = new Scene();
    const instanced = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), 2);
    instanced.setMatrixAt(0, new Matrix4().makeTranslation(-5, 0, 0));
    instanced.setMatrixAt(1, new Matrix4().makeTranslation(5, 0, 0));
    instanced.position.set(0, 2, 0);
    scene.add(instanced);

    const sphere = cullingSphereOf(scene, new Sphere());
    expect(sphere.center.x).toBeCloseTo(0, 12);
    expect(sphere.center.y).toBeCloseTo(2, 12);
    expect(sphere.center.z).toBeCloseTo(0, 12);
    expect(sphere.radius).toBeCloseTo(5 + HALF_DIAGONAL, 12);
  });
});
