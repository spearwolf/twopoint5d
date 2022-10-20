import { InstancedVertexObjectGeometry } from "twopoint5d";
import { BaseQuadDescriptor, InstancedQuadDescriptor } from "./descriptors.js";

export class InstancedQuadsGeometry extends InstancedVertexObjectGeometry {
  constructor(capacity) {
    super(InstancedQuadDescriptor, capacity, BaseQuadDescriptor);
  }
}
