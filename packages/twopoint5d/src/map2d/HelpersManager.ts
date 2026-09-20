import type {Object3D} from 'three/webgpu';
import {MathUtils} from 'three/webgpu';
import {findRootNode} from '../utils/findRootNode.js';

/**
 * A simple helper class that inserts nodes (-> Object3D) into a scene and marks them as helper to remove them later.
 */
export class HelpersManager {
  readonly uuid = MathUtils.generateUUID();

  #scene?: Object3D;
  #root?: Object3D;

  get scene(): Object3D | undefined {
    return this.#scene;
  }

  set scene(scene: Object3D | undefined) {
    if (this.#scene !== scene) {
      this.remove();
      this.#scene = scene;
      this.#root = undefined;
    }
  }

  get root(): Object3D | undefined {
    if (this.#root == null && this.#scene != null) {
      this.#root = findRootNode(this.#scene);
    }
    return this.#root;
  }

  /**
   * Inserts a node and takes it over: {@link removeFromScene} takes it out of the scene graph
   * again and calls its `dispose()` if it has one. A node that owns a geometry, a material or
   * a texture therefore has to release it there — `Box3Helper` and `PlaneHelper` of three.js
   * do, and a bare `THREE.Mesh` has no `dispose()` for the call to reach.
   *
   * A manager without a {@link scene} has nowhere to put the node and no way to take it down
   * again, so it refuses the handover with an error instead of accepting a node it would drop.
   * Whoever builds nodes for a manager that may not have one asks {@link scene} first.
   */
  add(node: Object3D, addToRoot = false): void {
    const target = addToRoot ? this.root : this.#scene;

    if (target == null) {
      throw new Error('HelpersManager#add() has no scene to add to: set HelpersManager#scene before handing a node over');
    }

    node.userData['isHelper'] = true;
    node.userData['createdBy'] = this.uuid;
    target.add(node);
  }

  /**
   * Takes the nodes of this manager out of the {@link scene} it holds and out of the {@link root}
   * above it. Without a scene there is nothing to take down and the call does nothing. What
   * happens to each node on the way out stands at {@link removeFromScene}.
   */
  remove(): void {
    if (this.#scene) {
      this.removeFromScene(this.#scene);
    }
  }

  /**
   * Takes every node this manager added to `scene` out of it, and calls `dispose()` on each one
   * that has such a method. What a node has to bring for that to be enough stands at {@link add}.
   *
   * The nodes of this manager sit in the {@link scene} it was given and in the {@link root} above
   * it, and only for that scene do both come down together. Any other scene is searched for the
   * nodes of this manager and otherwise left alone.
   */
  removeFromScene(scene: Object3D): void {
    const removeChildren: Object3D[] = [];
    for (const childNode of scene.children) {
      if (childNode.userData['isHelper'] && childNode.userData['createdBy'] === this.uuid) {
        removeChildren.push(childNode);
      }
    }
    for (const childNode of removeChildren) {
      childNode.removeFromParent();
      (childNode as unknown as {dispose?: () => void}).dispose?.();
    }
    if (scene === this.#scene && this.root != null && scene !== this.root) {
      this.removeFromScene(this.root);
    }
  }
}
