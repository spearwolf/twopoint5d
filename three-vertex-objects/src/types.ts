import {
  BufferAttribute,
  DynamicDrawUsage,
  InterleavedBuffer,
  StaticDrawUsage,
  StreamDrawUsage,
} from 'three';

import {VertexObjectBuffer} from './VertexObjectBuffer';
import {voBuffer, voIndex} from './constants';

/**
 * @category Vertex Objects
 */
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

/**
 * @category Vertex Objects
 */
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

/**
 * @category Vertex Objects
 */
export type VertexAttributeUsageType = 'static' | 'dynamic' | 'stream';

/**
 * @category Vertex Objects
 */
export interface VADescription {
  type?: VertexAttributeDataType;
  normalized?: boolean;
  usage?: VertexAttributeUsageType;
  autoTouch?: boolean;
}

/**
 * @category Vertex Objects
 */
export interface VAComponentsDescription extends VADescription {
  components: string[];
}

/**
 * @category Vertex Objects
 */
export interface VASizeDescription extends VADescription {
  size: number;
}

/**
 * @category Vertex Objects
 */
export type VertexAttributeDescription =
  | VAComponentsDescription
  | VASizeDescription;

/**
 * @category Vertex Objects
 */
export type VertexAttributesType = Record<string, VertexAttributeDescription>;

/**
 * @category Vertex Objects
 */
export interface VertexObjectDescription {
  vertexCount?: number;
  indices?: number[];
  meshCount?: number;
  attributes: VertexAttributesType;
  basePrototype?: Object | null | undefined;
  // TODO methods
}

/**
 * @category Vertex Objects
 */
export interface VO {
  [voBuffer]: VertexObjectBuffer;
  [voIndex]: number;
}

/**
 * @category Vertex Objects
 */
export type VOAttrSetter = (...values: number[] | [ArrayLike<number>]) => void;

/**
 * @category Vertex Objects
 */
export type VOAttrGetter = () => ArrayLike<number>;

/**
 * @category Vertex Objects
 */
export type BufferLike = InterleavedBuffer | BufferAttribute;

/**
 * @category Vertex Objects
 */
export type DrawUsageType =
  | typeof DynamicDrawUsage
  | typeof StaticDrawUsage
  | typeof StreamDrawUsage;

/**
 * @category Texture Mapping
 */
export type TextureSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement;
