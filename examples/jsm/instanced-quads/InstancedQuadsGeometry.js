import { InstancedVertexObjectGeometry } from "@spearwolf/vertex-objects";
import { BaseQuadDescriptor, InstancedQuadDescriptor } from "./descriptors.js";

export class InstancedQuadsGeometry extends InstancedVertexObjectGeometry {
  constructor(capacity) {
    super(InstancedQuadDescriptor, capacity, BaseQuadDescriptor);
  }
}
