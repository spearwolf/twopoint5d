// eslint-disable-next-line import/no-unresolved
import { InstancedVertexObjectGeometry } from "three-vertex-objects";

import {
  BaseSpriteDescriptor,
  InstancedSpriteDescriptor,
} from "./descriptors.js";

export class TexturedSpritesGeometry extends InstancedVertexObjectGeometry {
  constructor(capacity = 100, makeBaseSpriteArgs = [0.5, 0.5]) {
    super(InstancedSpriteDescriptor, capacity, BaseSpriteDescriptor);
    this.name = "TexturedSpritesGeometry";
    this.basePool.createVO().make(...makeBaseSpriteArgs);
  }
}
