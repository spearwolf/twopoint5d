import type {Object3D} from 'three/webgpu';
import {MathUtils} from 'three/webgpu';
import {findRootNode} from '../utils/findRootNode.js';

/**
 * A simple helper class that inserts nodes (-> Object3D) into a scene and marks them as helper to remove them later.
 */
export class HelpersManager {
  readonly uuid = MathUtils.generateUUID();

  #scene?: Object3D;

  // the nodes that went into the scene, and those that went into the root above it
  readonly #sceneNodes: Object3D[] = [];
  readonly #rootNodes: Object3D[] = [];

  // the root the `#rootNodes` hang in right now
  #root: Object3D | undefined;

  get scene(): Object3D | undefined {
    return this.#scene;
  }

  set scene(scene: Object3D | undefined) {
    if (this.#scene !== scene) {
      this.remove();
      this.#scene = scene;
    }
  }

  /** The root above the {@link scene} as it is at this moment, looked up on every access. */
  get root(): Object3D | undefined {
    return this.#scene != null ? findRootNode(this.#scene) : undefined;
  }

  /**
   * Moves the nodes that went into the root into the root the {@link scene} has now, when that is
   * another one than the one they hang in. The owner calls it on every pass, before it writes
   * nodes: a scene that comes into a scene graph after a node went into its root, or moves into
   * another one, takes those nodes along.
   */
  followRoot(): void {
    if (this.#scene == null || this.#rootNodes.length === 0) return;
    const root = findRootNode(this.#scene);
    if (root === this.#root) return;
    // indexed: the owner calls this on every pass of a frame loop
    for (let i = 0; i < this.#rootNodes.length; ++i) {
      // The loop bound is `this.#rootNodes.length`. three takes the node out of its old parent.
      root.add(this.#rootNodes[i]!);
    }
    this.#root = root;
  }

  /**
   * Inserts a node and takes it over: {@link remove} takes it out of the scene graph again and
   * calls its `dispose()` if it has one. A node that owns a geometry, a material or a texture
   * therefore has to release it there — `Box3Helper` and `PlaneHelper` of three.js do, and a bare
   * `THREE.Mesh` has no `dispose()` for the call to reach.
   *
   * With `addToRoot`, the node goes into the root above the {@link scene}, and {@link followRoot}
   * moves it along when that root changes.
   *
   * A manager without a {@link scene} has nowhere to put the node and no way to take it down
   * again, so it refuses the handover with an error instead of accepting a node it would drop.
   * Whoever builds nodes for a manager that may not have one asks {@link scene} first.
   */
  add(node: Object3D, addToRoot = false): void {
    const scene = this.#scene;
    if (scene == null) {
      throw new Error('HelpersManager#add() has no scene to add to: set HelpersManager#scene before handing a node over');
    }

    node.userData['isHelper'] = true;
    node.userData['createdBy'] = this.uuid;

    if (addToRoot) {
      // the nodes already there first, so that every root node hangs in the same root
      this.followRoot();
      const root = findRootNode(scene);
      this.#root = root;
      root.add(node);
      this.#rootNodes.push(node);
    } else {
      scene.add(node);
      this.#sceneNodes.push(node);
    }
  }

  /**
   * Takes every node of this manager out of the scene graph, wherever it hangs now, and calls
   * `dispose()` on each one that has such a method. What a node has to bring for that to be enough
   * stands at {@link add}. Without nodes the call does nothing.
   *
   * A node leaves the manager before its `dispose()` runs: when one throws, the error goes on, and
   * a second call takes down the nodes not reached yet.
   */
  remove(): void {
    HelpersManager.#takeDown(this.#sceneNodes);
    HelpersManager.#takeDown(this.#rootNodes);
    this.#root = undefined;
  }

  static #takeDown(nodes: Object3D[]): void {
    while (nodes.length > 0) {
      // The loop runs while the list holds a node.
      const node = nodes.pop()!;
      node.removeFromParent();
      (node as unknown as {dispose?: () => void}).dispose?.();
    }
  }
}
