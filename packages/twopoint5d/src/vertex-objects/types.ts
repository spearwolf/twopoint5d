import type {BufferAttribute, DynamicDrawUsage, InterleavedBuffer, StaticDrawUsage, StreamDrawUsage} from 'three/webgpu';
import type {VertexObjectBuffer} from './VertexObjectBuffer.js';
import type {voBuffer, voIndex} from './constants.js';

export type TypedArray =
  | Float64Array
  | Float32Array
  | Uint16Array
  | Uint32Array
  | Int32Array
  | Uint16Array
  | Int16Array
  | Uint8Array
  | Uint8ClampedArray
  | Int8Array;

export type VertexAttributeDataType =
  | 'float64'
  | 'float32'
  | 'float16'
  | 'uint32'
  | 'int32'
  | 'uint16'
  | 'int16'
  | 'uint8clamped'
  | 'uint8'
  | 'int8';

export type VertexAttributeUsageType = 'static' | 'dynamic' | 'stream';

export interface VADescription {
  type?: VertexAttributeDataType;
  normalized?: boolean;
  usage?: VertexAttributeUsageType;
  autoTouch?: boolean;
  bufferName?: string;
}

export interface VAComponentsDescription extends VADescription {
  components: string[];
}

export interface VASizeDescription extends VADescription {
  size: number;
}

export type VertexAttributeDescription = (VAComponentsDescription | VASizeDescription) & {
  getter?: string | boolean;
  setter?: string | boolean;
};

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
  [voBuffer]: VertexObjectBuffer;
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
