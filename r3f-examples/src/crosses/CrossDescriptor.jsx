import { getDescriptorOf } from "@spearwolf/three-vertex-objects";
import { Matrix4, Vector3 } from "three";

class Cross {
  make(width = 0.5, height = 0.5, innerSize = 1 / 8, outerSize = 1 / 2) {
    // prettier-ignore
    this.setPosition([
			- width * innerSize, + height * innerSize, 0,
			- width * innerSize, + height * outerSize, 0,
			+ width * innerSize, + height * outerSize, 0,
			+ width * innerSize, + height * innerSize, 0,
			+ width * outerSize, + height * innerSize, 0,
			+ width * outerSize, - height * innerSize, 0,
			+ width * innerSize, - height * innerSize, 0,
			+ width * innerSize, - height * outerSize, 0,
			- width * innerSize, - height * outerSize, 0,
			- width * innerSize, - height * innerSize, 0,
			- width * outerSize, - height * innerSize, 0,
			- width * outerSize, + height * innerSize, 0,
		]);
  }

  rotate(angle) {
    const theta = (angle * 180) / Math.PI;
    this.transform(new Matrix4().makeRotationZ(theta));
  }

  translate(x, y, z = 0) {
    this.transform(new Matrix4().makeTranslation(x, y, z));
  }

  transform(transform) {
    const tmp = new Vector3();
    const { vertexCount } = getDescriptorOf(this);
    for (let i = 0; i < vertexCount; i++) {
      this.setVertexPosition(
        i,
        this.getVertexPosition(i, tmp).applyMatrix4(transform)
      );
    }
  }

  getVertexPosition(idx, target) {
    target.x = this[`x${idx}`];
    target.y = this[`y${idx}`];
    target.z = this[`z${idx}`];
    return target;
  }

  setVertexPosition(idx, position) {
    this[`x${idx}`] = position.x;
    this[`y${idx}`] = position.y;
    this[`z${idx}`] = position.z;
  }
}

export const CrossDescriptor = {
  vertexCount: 12,
  indices: [0, 2, 1, 0, 3, 2, 10, 4, 11, 10, 5, 4, 7, 9, 8, 7, 6, 9],

  attributes: {
    position: { components: ["x", "y", "z"] },
  },

  basePrototype: Cross.prototype,
};
