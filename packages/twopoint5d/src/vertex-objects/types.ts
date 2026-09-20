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

/** Selects which buffers a geometry uploads to the GPU, keyed by the usage type of their attributes. */
export type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

export interface VADescription {
  /** The element type of the buffer this attribute is stored in. Defaults to `'float32'`. */
  type?: VertexAttributeDataType;
  /**
   * Whether the gpu maps the stored integers onto `0` … `1` (`-1` … `1` for a signed type)
   * when it reads this attribute, instead of taking each value as the number it is. Has no
   * effect on a floating point type. Defaults to `false`.
   */
  normalized?: boolean;
  /**
   * How often the values of this attribute are expected to change. It becomes the draw usage
   * of the buffer and, unless `autoTouch` says otherwise, decides whether that buffer is
   * uploaded on every `update()`. Defaults to `'static'`.
   */
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
  /**
   * The buffer that holds the values of this attribute. Defaults to
   * `` `${usage}_${type}${normalized ? 'N' : ''}` ``, so attributes that agree on all three end
   * up together by themselves. Every attribute that names the same buffer shares one
   * interleaved buffer with the others, which is one gpu upload for all of them instead of one
   * each — name a buffer to group attributes that are written in the same breath.
   */
  bufferName?: string;
}

export interface VAComponentsDescription extends VADescription {
  /**
   * One name per element of the attribute, which is one of the two ways to give an attribute
   * its size: as many elements as there are names here.
   *
   * Every name becomes a property of the vertex object that reads and writes that one element,
   * and with a `vertexCount` above 1 each of them carries the vertex index: `components:
   * ['x', 'y']` and `vertexCount: 4` give a vertex object `x0` … `x3` and `y0` … `y3`.
   */
  components: string[];
}

export interface VASizeDescription extends VADescription {
  /**
   * How many elements the attribute holds per vertex, which is the other way to give an
   * attribute its size — the one for elements that need no names of their own.
   *
   * A description may declare `components` as well, and then names at most `size` of them;
   * fewer leave the rest of the attribute without a name of its own, and the attribute keeps
   * the size declared here.
   */
  size: number;
}

/**
 * The names of the two methods a vertex object gets for an attribute that holds more than one
 * value — `size` above 1, `vertexCount` above 1, or both. An attribute of a single value on a
 * single vertex becomes a property of the attribute's own name instead, and these two names
 * are then unused.
 */
export interface VertexAttributeMethods {
  /**
   * The name of the method that reads every value of this attribute at once.
   *
   * The key itself decides, not only its value: a description *without* this key gets the
   * default name — `get` plus the attribute name in PascalCase — while a description that
   * *carries* the key with a falsy value (`false`, `undefined` or `null`) gets no getter at
   * all. A string names it. `{getter: undefined}` is therefore not the same as an object
   * without a `getter`; see {@link VertexAttributeDescriptor#getterName}.
   */
  getter?: string | boolean;
  /**
   * The name of the method that writes every value of this attribute at once. The key decides
   * the same way `getter` does: absent gives the default name — `set` plus the attribute name
   * in PascalCase — present and falsy gives no setter, a string names it. See
   * {@link VertexAttributeDescriptor#setterName}.
   */
  setter?: string | boolean;
}

export type VAComponentsType = VAComponentsDescription & VertexAttributeMethods;
export type VASizeType = VASizeDescription & VertexAttributeMethods;

export type VertexAttributeDescription = VAComponentsType | VASizeType;
export type VertexAttributesType = Record<string, VertexAttributeDescription>;

export interface VertexObjectDescription {
  /** How many vertices one vertex object is made of. Defaults to `1`. */
  vertexCount?: number;
  /**
   * The draw order of the vertices of one vertex object, as indices into the object's own
   * vertices — integers in `0` … `vertexCount - 1`. Every object of a pool is drawn by this one
   * list; the geometry repeats it per object with the offsets applied.
   */
  indices?: number[];
  /** The attributes of a vertex object, keyed by the name the geometry gives them. */
  attributes: VertexAttributesType;
  /**
   * The prototype the generated accessors of a vertex object are placed on, which is how
   * methods and accessors of your own reach a vertex object.
   *
   * No name a generated accessor takes may appear on it, neither as an own property nor
   * inherited from a prototype below `Object.prototype`: the descriptor refuses such a
   * description rather than let the accessor shadow that property in silence.
   */
  basePrototype?: object | null | undefined;
  /**
   * Functions that become properties of every vertex object of this description, keyed by the
   * name they get there. Only values of type function are taken; anything else is ignored.
   */
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
