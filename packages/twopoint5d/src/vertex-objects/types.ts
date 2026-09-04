import type {BufferAttribute, DynamicDrawUsage, InterleavedBuffer, StaticDrawUsage, StreamDrawUsage} from 'three/webgpu';
import type {VertexObjectBuffer} from './VertexObjectBuffer.js';
import type {voBuffer, voIndex} from './constants.js';

export type TypedArray =
  | Float64Array
  | Float32Array
  | Float16Array
  | Uint32Array
  | Int32Array
  | Uint16Array
  | Int16Array
  | Uint8ClampedArray
  | Uint8Array
  | Int8Array;

export type VertexAttributeDataType =
  'float64' | 'float32' | 'float16' | 'uint32' | 'int32' | 'uint16' | 'int16' | 'uint8clamped' | 'uint8' | 'int8';

export type VertexAttributeUsageType = 'static' | 'dynamic' | 'stream';

export interface VADescription {
  type?: VertexAttributeDataType;
  normalized?: boolean;
  usage?: VertexAttributeUsageType;
  /**
   * Whether the geometry uploads this attribute's buffer to the GPU on every `update()`,
   * regardless of whether any of its values changed. Defaults to `false` for `usage: 'static'`
   * and `true` for `'dynamic'`/`'stream'` (see {@link VertexAttributeDescriptor#autoTouch}).
   *
   * The generated property setters do not mark a buffer dirty when they write a value —
   * `autoTouch` is therefore the only path by which written values reach the GPU at all, unless
   * the caller calls `touch()` explicitly. That makes it the default choice for anything meant
   * to change from frame to frame, at the cost of a full buffer upload every `update()` whether
   * or not a value actually changed — for a large, mostly static pool with a few dynamic
   * attributes, that is a full upload of those buffers 60 times a second.
   *
   * Set to `false` and call `touch()` (or `touchAttributes()`/`touchBuffers()`) after writing to
   * upload only the frames in which something actually happened.
   */
  autoTouch?: boolean;
  bufferName?: string;
  // TODO add optional attributeName? to VADescription
}

export interface VAComponentsDescription extends VADescription {
  components: string[];
}

export interface VASizeDescription extends VADescription {
  size: number;
}

export interface VertexAttributeMethods {
  getter?: string | boolean;
  setter?: string | boolean;
}

export type VAComponentsType = VAComponentsDescription & VertexAttributeMethods;
export type VASizeType = VASizeDescription & VertexAttributeMethods;

export type VertexAttributeDescription = VAComponentsType | VASizeType;
export type VertexAttributesType = Record<string, VertexAttributeDescription>;

export interface VertexObjectDescription {
  vertexCount?: number;
  indices?: number[];
  meshCount?: number;
  attributes: VertexAttributesType;
  basePrototype?: object | null | undefined;
  methods?: object | null | undefined;
}

export interface VO {
  /**
   * The buffer that backs this vertex object, and unset once the pool has let it go:
   * a disposed or freed vertex object keeps its properties but no longer reaches a buffer.
   */
  [voBuffer]: VertexObjectBuffer | undefined;
  [voIndex]: number;
}

export type VOAttrSetter = (...values: number[] | [ArrayLike<number>]) => void;

export type VOAttrGetter = () => ArrayLike<number>;

export type BufferLike = InterleavedBuffer | BufferAttribute;

export type DrawUsageType = typeof DynamicDrawUsage | typeof StaticDrawUsage | typeof StreamDrawUsage;

export interface VertexObjectBuffersData {
  capacity: number;
  usedCount: number;
  buffers: Record<string, TypedArray>;
}
