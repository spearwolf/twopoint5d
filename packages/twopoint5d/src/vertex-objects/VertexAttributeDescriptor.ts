import type {
  VAComponentsDescription,
  VASizeDescription,
  VertexAttributeDataType,
  VertexAttributeDescription,
  VertexAttributeMethods,
  VertexAttributeUsageType,
} from './types.js';

const toPascalCase = (str: string) => str.replace(/(^|_)([a-z])/g, (_match: string, _m0: string, m1: string) => m1.toUpperCase());

type VADescriptionFields = Partial<VASizeDescription> & Partial<VAComponentsDescription> & VertexAttributeMethods;

export class VertexAttributeDescriptor {
  /**
   * A description declares either `components` or `size`, and the getters below
   * answer both forms in a single expression — a union of the two halves can't
   * express that, so the stored field is the partial intersection of both.
   */
  private readonly description: VADescriptionFields;

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

  /**
   * Defaults to `false` for `usageType: 'static'` and `true` otherwise.
   * See {@link VADescription#autoTouch} for what this controls.
   */
  get autoTouch(): boolean {
    return this.description.autoTouch ?? this.usageType !== 'static';
  }

  get size(): number {
    return this.description.size ?? this.description.components?.length ?? 1;
  }

  get hasComponents(): boolean {
    return (this.description.components?.length ?? 0) > 0;
  }

  get components(): string[] {
    return this.description.components ?? [];
  }

  get bufferName(): string {
    return this.description.bufferName ?? `${this.usageType}_${this.dataType}${this.normalizedData ? 'N' : ''}`;
  }

  get getterName(): string | undefined {
    if ('getter' in this.description && !this.description.getter) {
      return undefined;
    }
    if (typeof this.description.getter === 'string') return this.description.getter;
    return `get${toPascalCase(this.name)}`;
  }

  get setterName(): string | undefined {
    if ('setter' in this.description && !this.description.setter) {
      return undefined;
    }
    if (typeof this.description.setter === 'string') return this.description.setter;
    return `set${toPascalCase(this.name)}`;
  }
}
