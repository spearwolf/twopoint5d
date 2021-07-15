import {
  BufferAttribute,
  DynamicDrawUsage,
  InterleavedBuffer,
  StaticDrawUsage,
  StreamDrawUsage,
} from 'three';

import {VertexObjectBuffer} from './VertexObjectBuffer';
import {voIndex0, voBuffer, voIndex, voBatch} from './constants';

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
}

export interface VAComponentsDescription extends VADescription {
  components: string[];
}

export interface VASizeDescription extends VADescription {
  size: number;
}

export type VertexAttributeDescription =
  | VAComponentsDescription
  | VASizeDescription;

export type VertexAttributesType = Record<string, VertexAttributeDescription>;

export interface VertexObjectDescription {
  vertexCount?: number;
  indices?: number[];
  meshCount?: number;
  attributes: VertexAttributesType;
  basePrototype?: Object | null | undefined;
  // TODO methods
}

export type VOBatchType = [size: number, start: number];

export interface VO {
  [voBuffer]: VertexObjectBuffer;
  [voIndex]: number;
  [voIndex0]: number;
  [voBatch]?: VOBatchType;
}

export type VOAttrSetter = (...values: number[] | [ArrayLike<number>]) => void;

export type VOAttrGetter = () => ArrayLike<number>;

export type BufferLike = InterleavedBuffer | BufferAttribute;

export type DrawUsageType =
  | typeof DynamicDrawUsage
  | typeof StaticDrawUsage
  | typeof StreamDrawUsage;

export type TextureSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement;
