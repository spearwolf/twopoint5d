import type {
  FrozenVertexAttributeDescription,
  VASizeDescription,
  VertexAttributeDataType,
  VertexAttributeDescription,
  VertexAttributeMethods,
  VertexAttributeUsageType,
} from './types.js';

// three 0.186.1 builds no vertex format of one value for an 8- or 16-bit integer: its table for one
// value knows the 32-bit types alone (`WebGPUAttributeUtils.js:32–36`, `:518–520`). Such an attribute
// is laid out in 32 bits from the start, so the gpu reads the array of the pool as it is
const LAYOUT_OF_ONE_VALUE: Partial<Record<VertexAttributeDataType, VertexAttributeDataType>> = {
  int8: 'int32',
  int16: 'int32',
  uint8: 'uint32',
  uint16: 'uint32',
};

const toPascalCase = (str: string) => str.replace(/(^|_)([a-z])/g, (_match: string, _m0: string, m1: string) => m1.toUpperCase());

// read-only throughout, and the components with them: this descriptor only ever reads, and the
// description it is built from may be the frozen one a VertexObjectDescriptor hands out
type VADescriptionFields = Readonly<Partial<VASizeDescription>> &
  Readonly<VertexAttributeMethods> & {readonly components?: readonly string[]};

/**
 * A single attribute of a `VertexObjectDescriptor`: its type, size, components and usage.
 * It sits below both layers, the one that works on buffer indices and the one that hands out
 * typed objects.
 */
export class VertexAttributeDescriptor {
  /**
   * A description declares either `components` or `size`, and the getters below
   * answer both forms in a single expression — a union of the two halves can't
   * express that, so the stored field is the partial intersection of both.
   */
  private readonly description: VADescriptionFields;

  readonly name: string;

  constructor(name: string, description: VertexAttributeDescription | FrozenVertexAttributeDescription) {
    this.name = name;
    this.description = description;
  }

  /**
   * The type the values of this attribute are laid out in: the declared `type`, or `'float32'`
   * without one. An attribute of `'int8'` or `'int16'` with a single value and without `normalized`
   * is laid out as `'int32'`, one of `'uint8'` or `'uint16'` as `'uint32'` — three builds no vertex
   * format of one value for these types. Its buffer, its buffers data and the arrays its getter
   * answers take this type.
   */
  get dataType(): VertexAttributeDataType {
    const declared = this.description.type ?? 'float32';
    if (this.size !== 1 || this.normalizedData) return declared;
    return LAYOUT_OF_ONE_VALUE[declared] ?? declared;
  }

  get normalizedData(): boolean {
    return Boolean(this.description.normalized);
  }

  get usageType(): VertexAttributeUsageType {
    return this.description.usage ?? 'static';
  }

  /**
   * Defaults to `false` for `usageType: 'static'` and `true` otherwise.
   * See `VADescription#autoTouch` for what this controls.
   */
  get autoTouch(): boolean {
    return this.description.autoTouch ?? this.usageType !== 'static';
  }

  /**
   * The `size` of the description, or the number of its `components`. A `VertexObjectDescriptor`
   * refuses an attribute that declares neither; a `VertexAttributeDescriptor` built on its own,
   * without going through one, answers `1` for such an attribute instead.
   */
  get size(): number {
    return this.description.size ?? this.description.components?.length ?? 1;
  }

  get hasComponents(): boolean {
    return (this.description.components?.length ?? 0) > 0;
  }

  get components(): readonly string[] {
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
