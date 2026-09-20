import type {BufferAttribute, DynamicDrawUsage, InterleavedBuffer, StaticDrawUsage, StreamDrawUsage} from 'three/webgpu';
import type {VertexObjectBuffer} from './VertexObjectBuffer.js';
import type {voBuffer, voIndex} from './constants.js';

/**
 * The typed arrays a vertex object buffer stores its values in — one per
 * {@link VertexAttributeDataType}, which names the same set of element types.
 */
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

/** The element type of the buffer an attribute is stored in, named as the typed array that holds it: `'float32'` is a `Float32Array`. */
export type VertexAttributeDataType =
  'float64' | 'float32' | 'float16' | 'uint32' | 'int32' | 'uint16' | 'int16' | 'uint8clamped' | 'uint8' | 'int8';

/**
 * How often the values of an attribute change: `'static'` for values written once, `'dynamic'` and
 * `'stream'` for values rewritten over the life of the pool. It becomes the draw usage of the
 * buffer that holds the attribute.
 */
export type VertexAttributeUsageType = 'static' | 'dynamic' | 'stream';

/** Selects which buffers a geometry uploads to the GPU, keyed by the usage type of their attributes. */
export type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

/**
 * What every attribute description states about how its values are stored, whichever way it gives
 * its size. {@link VAComponentsDescription} and {@link VASizeDescription} extend it by that one
 * way each.
 */
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

/** An attribute description that gives its size by naming each of its elements. */
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

/** An attribute description that gives its size as a number of elements. */
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

/** A {@link VAComponentsDescription} together with the names of its getter and setter. */
export type VAComponentsType = VAComponentsDescription & VertexAttributeMethods;
/** A {@link VASizeDescription} together with the names of its getter and setter. */
export type VASizeType = VASizeDescription & VertexAttributeMethods;

/** One attribute of a {@link VertexObjectDescription}, sized either by `components` or by `size`. */
export type VertexAttributeDescription = VAComponentsType | VASizeType;
/** The attributes of a {@link VertexObjectDescription}, keyed by the name the geometry gives them. */
export type VertexAttributesType = Record<string, VertexAttributeDescription>;

/**
 * What a vertex object is made of: its attributes, how many vertices it has and how they are
 * drawn, and the behaviour it carries. A {@link VertexObjectDescriptor} checks it once, and every
 * pool and geometry is built from that descriptor.
 */
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

/**
 * A vertex object as a pool hands it out: the slot it occupies in a {@link VertexObjectBuffer}.
 * The interfaces of the sprite types extend it with the accessors their description generates.
 */
export interface VO {
  /**
   * The buffer that backs this vertex object, and unset once the pool has let it go:
   * a disposed or freed vertex object keeps its properties but no longer reaches a buffer.
   */
  [voBuffer]: VertexObjectBuffer | undefined;
  /** The index of this vertex object among the objects of its buffer, which is where its values start. */
  [voIndex]: number;
}

/**
 * The generated method that writes every value of an attribute at once, as separate arguments or
 * as one array-like: `setPos(1, 2)` and `setPos([1, 2])` do the same. It is the type to give the
 * `set…` method of a vertex object interface.
 */
export type VOAttrSetter = (...values: number[] | [ArrayLike<number>]) => void;

/** The generated method that reads every value of an attribute at once. It is the type to give the `get…` method of a vertex object interface. */
export type VOAttrGetter = () => ArrayLike<number>;

/** The three.js buffer a geometry holds the values of an attribute in — interleaved when several attributes share one. */
export type BufferLike = InterleavedBuffer | BufferAttribute;

/** The three.js draw usage constant a buffer is created with, chosen by the {@link VertexAttributeUsageType} of its attributes. */
export type DrawUsageType = typeof DynamicDrawUsage | typeof StaticDrawUsage | typeof StreamDrawUsage;

/**
 * A snapshot of the buffers of a {@link VOBufferPool}, as `toBuffersData()` hands it out and
 * `fromBuffersData()` takes it in — the way to move the contents of a pool to another one built
 * from the same description, or across a worker boundary.
 */
export interface VertexObjectBuffersData {
  /** How many vertex objects the buffers were sized for; only a pool of this very capacity takes the snapshot in. */
  capacity: number;
  /** How many of those vertex objects are in use. */
  usedCount: number;
  /** The typed array of each buffer, keyed by buffer name. */
  buffers: Record<string, TypedArray>;
}
