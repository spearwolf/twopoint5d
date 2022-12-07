import {MathUtils, Object3D} from 'three';

/**
 * A simple helper class that inserts nodes (-> Object3D) into a scene and marks them as helper to remove them later.
 */
export class HelpersManager {
  readonly uuid = MathUtils.generateUUID();

  #scene?: Object3D;

  get scene(): Object3D | undefined {
    return this.#scene;
  }

  set scene(scene: Object3D | undefined) {
    if (this.#scene !== scene) {
      this.remove();
      this.#scene = scene;
    }
  }

  add(node: Object3D): void {
    if (this.#scene) {
      node.userData.isHelper = true;
      node.userData.createdBy = this.uuid;
      this.#scene.add(node);
    }
  }

  remove() {
    if (this.#scene) {
      this.removeFromScene(this.#scene);
    }
  }

  removeFromScene(scene: Object3D): void {
    const removeChilds: Object3D[] = [];
    for (const childNode of scene.children) {
      if (childNode.userData.isHelper && childNode.userData.createdBy === this.uuid) {
        removeChilds.push(childNode);
      }
    }
    for (const childNode of removeChilds) {
      childNode.removeFromParent();
      (childNode as any).dispose?.();
    }
  }
}
