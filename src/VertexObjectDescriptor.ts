import {VertexAttributeDescriptor} from './VertexAttributeDescriptor';
import {VertexObjectDescription} from './types';

export class VertexObjectDescriptor {
  private readonly description: VertexObjectDescription;

  readonly attributes: Map<string, VertexAttributeDescriptor>;
  readonly bufferNames: Set<string>;

  constructor(description: VertexObjectDescription) {
    this.description = description;
    this.attributes = new Map();
    this.bufferNames = new Set();
    Object.entries(this.description.attributes).forEach(
      ([attrName, attrDesc]) => {
        const descriptor = new VertexAttributeDescriptor(attrName, attrDesc);
        this.attributes.set(attrName, descriptor);
        this.bufferNames.add(descriptor.bufferName);
      },
    );
  }

  /** Returns `vertexCount` or `1` */
  get vertexCount(): number {
    return this.description.vertexCount ?? 1;
  }

  getInstanceCount(capacity: number): number {
    const meshCount = this.description.meshCount ?? 1;
    return meshCount > 1 ? Math.ceil(capacity / meshCount) : capacity;
  }

  get hasIndices(): boolean {
    return this.description.indices?.length > 0;
  }

  get indices(): number[] {
    return this.description.indices ?? [];
  }

  get attributeNames(): string[] {
    return Array.from(this.attributes.keys());
  }

  getAttribute(name: string): VertexAttributeDescriptor | undefined {
    return this.attributes.get(name);
  }
}
