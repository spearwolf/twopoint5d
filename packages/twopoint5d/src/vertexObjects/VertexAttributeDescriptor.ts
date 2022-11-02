import {VertexAttributeDataType, VertexAttributeDescription, VertexAttributeUsageType} from './types';

/**
 * @category Vertex Objects
 */
export class VertexAttributeDescriptor {
  private readonly description: VertexAttributeDescription;

  readonly name: string;

  constructor(name: string, description: VertexAttributeDescription) {
    this.name = name;
    this.description = description;
  }

  get dataType(): VertexAttributeDataType {
    return this.description.type ?? 'float32';
  }

  get normalizedData(): boolean {
    return Boolean(this.description.normalized);
  }

  get usageType(): VertexAttributeUsageType {
    return this.description.usage ?? 'static';
  }

  get autoTouch(): boolean {
    return this.description.autoTouch ?? this.usageType !== 'static';
  }

  get size(): number {
    // @ts-ignore
    return this.description.size ?? this.description.components?.length ?? 1;
  }

  get hasComponents(): boolean {
    // @ts-ignore
    return this.description.components?.length > 0;
  }

  get components(): string[] {
    // @ts-ignore
    return this.description.components ?? [];
  }

  get bufferName(): string {
    return `${this.usageType}_${this.dataType}${this.normalizedData ? 'N' : ''}`;
  }
}
