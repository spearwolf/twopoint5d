import {VOBufferPool} from './VOBufferPool.js';
import {VOUtils} from './VOUtils.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {createVertexObject} from './createVertexObject.js';
import {voBuffer, voInitialize} from './constants.js';
import {sortSlots} from './sortSlots.js';
import type {
  TypedArray,
  VO,
  VOSortKey,
  VOSortOptions,
  VertexAttributeDataType,
  VertexObjectBuffersData,
  VertexObjectDescription,
} from './types.js';
import {type ValuePropertyLayout, valuePropertyLayouts} from './valuePropertyLayouts.js';

// read once into constants of this module, so the loops of a sort never touch an imported binding: a
// module runner that rewrites imports, as the one Vitest runs specs and benches in does, turns every
// read of one into a property read on a module object
const sortSlotOrder: typeof sortSlots = sortSlots;
const setVOIndex: typeof VOUtils.setIndex = VOUtils.setIndex;

// one message for every method that refuses to work once the pool is gone, so the class, the
// method and the state are always in the text a caller reads out of a foreign stack
function disposedError(method: string): Error {
  return new Error(`VertexObjectPool#${method} is not available: this pool has been disposed`);
}

// the value properties a refusal of sortBy() lists at most
const LISTED_VALUE_PROPERTIES = 12;

function unknownSortKeyError(name: string, layouts: ReadonlyMap<string, ValuePropertyLayout>): Error {
  const names = [...layouts.keys()];
  if (names.length === 0) {
    return new Error(
      `VertexObjectPool#sortBy(): "${name}" is no value property of the vertex objects of this pool, which have none — hand in a key function (vo) => number`,
    );
  }
  const listed = names.slice(0, LISTED_VALUE_PROPERTIES);
  if (names.length > LISTED_VALUE_PROPERTIES) listed.push('…');
  return new Error(
    `VertexObjectPool#sortBy(): "${name}" is no value property of the vertex objects of this pool — name one of ${listed.join(', ')}, or hand in a key function (vo) => number`,
  );
}

function keyFunctionChangedPoolError(from: number, to: number): Error {
  return new Error(
    `VertexObjectPool#sortBy(): the key function changed usedCount from ${from} to ${to} — create and free vertex objects before or after the sort, not inside the key function`,
  );
}

// a view of the scratch of a sort in the type of the buffer it takes a copy of, so that every value
// goes over as it is
function scratchViewOf(dataType: VertexAttributeDataType, buffer: ArrayBuffer): TypedArray {
  switch (dataType) {
    case 'float64':
      return new Float64Array(buffer);
    case 'float32':
      return new Float32Array(buffer);
    case 'float16':
      return new Float16Array(buffer);
    case 'uint32':
      return new Uint32Array(buffer);
    case 'int32':
      return new Int32Array(buffer);
    case 'uint16':
      return new Uint16Array(buffer);
    case 'int16':
      return new Int16Array(buffer);
    case 'uint8':
      return new Uint8Array(buffer);
    case 'uint8clamped':
      return new Uint8ClampedArray(buffer);
    case 'int8':
      return new Int8Array(buffer);
  }
}

/**
 * Hands out `VOType` objects whose generated getters and setters write into the buffers of this
 * pool: the typed layer on top of {@link VOBufferPool}, which only knows buffer indices.
 */
export class VertexObjectPool<VOType> extends VOBufferPool {
  // a slot is empty until a vertex object materializes in it, and empty again once one is freed
  #voIndex: Array<(VOType & VO) | undefined>;

  /**
   * Called for every vertex object this pool materializes — by {@link createVO} after the
   * `voInitialize` hook, and by {@link getVO} for a slot that holds no vertex object yet. The
   * hook stays where it is once {@link VOBufferPool#dispose} has run and is never called again —
   * neither {@link createVO} nor {@link getVO} builds a vertex object on a disposed pool.
   */
  onCreateVO?: (vo: VOType & VO) => (VOType & VO) | void;

  // the scratch of sortBy() and sortByKeys(), built by the first sort, grown with the capacity and
  // let go of by dispose(): the keys, the order of the slots and the merge scratch of the sort, the
  // vertex objects on their way to a new slot, and one buffer for the copy of every attribute buffer
  // with a view of it per data type
  #sortKeys: Float64Array | undefined;
  #sortOrder: Uint32Array | undefined;
  #sortMerge: Uint32Array | undefined;
  #sortVOs: Array<(VOType & VO) | undefined> = [];
  #sortScratch: ArrayBuffer | undefined;
  readonly #sortScratchViews = new Map<VertexAttributeDataType, TypedArray>();
  #valueLayouts: ReadonlyMap<string, ValuePropertyLayout> | undefined;

  constructor(descriptor: VertexObjectDescriptor | VertexObjectDescription, capacityOrData: number | VertexObjectBuffersData) {
    super(descriptor, capacityOrData);
    this.#voIndex = new Array(this.capacity);
  }

  /**
   * Resizes the pool to a new capacity.
   *
   * Only allowed as long as the pool does not back a geometry: the `THREE.BufferAttribute`s
   * and their GPU buffers take their size from the pool capacity exactly once, so a live
   * geometry cannot follow along. While {@link VOBufferPool#isAttachedToGeometry} holds, the
   * method throws for every capacity but the one the pool already has — resizing to the
   * current capacity leaves the buffers alone and is therefore allowed.
   *
   * Throws on a disposed pool, which has no buffers left to size. The method already turns
   * away a capacity it cannot serve, and a resize that allocated fresh buffers would put a
   * disposed pool back into service.
   *
   * If the new capacity is larger, the pool will be able to hold more vertex objects.
   * If it is smaller, every vertex object from the new capacity onwards is unlinked from its
   * buffer — any further read or write on such a vertex object fails. The `usedCount` is
   * capped at the new capacity.
   *
   * @throws a `RangeError` that names the value when `capacity` is no integer of 0 or more
   */
  resize(capacity: number): void {
    if (this.isDisposed) {
      throw disposedError('resize()');
    }

    if (capacity < 0 || !Number.isInteger(capacity)) {
      throw new RangeError(`VertexObjectPool#resize(): capacity must be a non-negative integer, got ${String(capacity)}`);
    }

    if (capacity === this.capacity) return;

    if (this.isAttachedToGeometry) {
      throw new Error(
        'resize() is only allowed before the pool is attached to a geometry: the three.js attributes and their GPU buffers are sized once from the pool capacity and cannot be grown or shrunk afterwards',
      );
    }

    const newBuffer = new VertexObjectBuffer(this.descriptor, capacity);

    const copyCount = Math.min(this.usedCount, capacity);
    if (copyCount > 0) {
      const {vertexCount} = this.descriptor;
      for (const [bufferName, oldBuf] of this.buffer.buffers) {
        const newBuf = newBuffer.buffers.get(bufferName)!;
        const copyLength = copyCount * vertexCount * oldBuf.itemSize;
        // both buffers are reached through a live pool, so both hold their arrays
        newBuf.typedArray!.set(oldBuf.typedArray!.subarray(0, copyLength));
      }
    }

    // this buffer is new, and a route that is given it later can have seen nothing of it
    newBuffer.touch();

    this.buffer = newBuffer;

    const newVoIndex: Array<(VOType & VO) | undefined> = new Array(capacity);
    for (let i = 0; i < copyCount; i++) {
      const vo = this.#voIndex[i];
      if (vo != null) {
        vo[voBuffer] = newBuffer;
        newVoIndex[i] = vo;
      }
    }

    // vertex objects beyond the new capacity have no slot any more; unlinking
    // them makes a later write fail loudly instead of landing in the detached buffer
    for (let i = copyCount; i < this.#voIndex.length; i++) {
      const vo = this.#voIndex[i];
      if (vo != null) {
        VOUtils.clearBuffer(vo);
      }
    }

    this.#voIndex = newVoIndex;

    this.setCapacity(capacity);

    this.usedCount = Math.min(this.usedCount, capacity);
  }

  /**
   * Takes the next free slot of this pool and answers the vertex object sitting in it.
   *
   * Answers `undefined` once `usedCount` has reached `capacity`, and on a disposed pool,
   * which has no slot to give: the declared type admits absence, and a caller has to
   * handle it either way. A refused slot is not counted — `usedCount` stays where it is.
   *
   * Before it answers, the pool runs the `voInitialize` hook of the vertex object, when its
   * prototype has one, and then {@link onCreateVO}. This is the one place the hook runs, and the
   * upload mark covers what it wrote.
   *
   * The slot that is handed out is marked for upload, and it alone.
   */
  createVO(): (VOType & VO) | undefined {
    if (this.isDisposed) return undefined;
    if (this.usedCount < this.capacity) {
      const idx = this.usedCount++;
      const vo = this.#createVO(idx, true);
      this.#voIndex[idx] = vo;
      // the slot arrives carrying whatever stood in it before, and the draw range has just grown
      // over it, so its vertices have to reach the gpu
      this.buffer.touch(idx, idx);
      return vo;
    }
    return undefined;
  }

  /**
   * Whether this vertex object reads and writes through the buffer of this pool.
   *
   * `false` on a disposed pool, whatever a vertex object points at: a pool that has given up
   * its buffers holds none of them any more, and putting one back afterwards does not change
   * that.
   */
  containsVO(vo: VO): boolean {
    if (this.isDisposed) return false;
    return VOUtils.isBuffer(vo, this.buffer);
  }

  /**
   * Marks the slot of `vo` for upload: the next `update()` of every geometry on this pool uploads
   * that slot, and the slots marked within one frame go up in at most eight ranges per buffer.
   * With attribute names only the buffers behind them are marked, without any every buffer of
   * the pool.
   *
   * The narrow way for an attribute with `autoTouch: false`: write through the vertex object, then
   * say which one was written. An attribute with `autoTouch` uploads every object in use on every
   * `update()` anyway.
   *
   * A silent no-op for a vertex object of another pool, for one that has been freed, and on a
   * disposed pool — the same cases {@link freeVO} turns away through {@link containsVO}. An
   * attribute name the descriptor does not know marks nothing.
   */
  touchVO(vo: VO, ...attrNames: string[]): void;
  touchVO(vo: VO): void {
    if (!this.containsVO(vo)) return;

    const idx = VOUtils.getIndex(vo);
    // biome-ignore lint/complexity/noArguments: only the count is read, see the comment above the loop below
    if (arguments.length === 1) {
      this.buffer.touch(idx, idx);
      return;
    }

    // the names are read through `arguments` rather than the rest parameter of the signature, as in
    // the touch() of the geometries: V8 does not keep a rest array off the heap in every state of
    // the optimizer, `arguments` it did
    // biome-ignore lint/complexity/noArguments: only the count is read, see the comment above the loop
    for (let i = 1; i < arguments.length; i++) {
      // biome-ignore lint/complexity/noArguments: see the comment above the loop
      const layout = this.buffer.bufferAttributes.get(arguments[i] as string);
      if (layout !== undefined) {
        this.buffer.touchBuffer(layout.bufferName, idx, idx);
      }
    }
  }

  /** @internal */
  protected override onUsedCountShrunk(from: number, to: number): void {
    for (let i = to; i < from; i++) {
      const vo = this.#voIndex[i];
      // only a slot that holds a vertex object is written: resize() calls the setter after it has
      // swapped in an index of the new capacity, and a write beyond that would lengthen the array
      if (vo != null) {
        VOUtils.clearBuffer(vo);
        this.#voIndex[i] = undefined;
      }
    }
  }

  /**
   * In addition to {@link VOBufferPool#dispose}, this also unlinks the buffer
   * reference from every still-tracked vertex object and drops the internal
   * VO index.
   */
  override dispose(): void {
    if (this.isDisposed) return;
    for (let i = 0; i < this.#voIndex.length; i++) {
      const vo = this.#voIndex[i];
      if (vo != null) {
        VOUtils.clearBuffer(vo);
      }
    }
    this.#voIndex.length = 0;
    this.#sortKeys = undefined;
    this.#sortOrder = undefined;
    this.#sortMerge = undefined;
    this.#sortVOs = [];
    this.#sortScratch = undefined;
    this.#sortScratchViews.clear();
    super.dispose();
  }

  /**
   * The fastest variant is when the VO was the last one created,
   * otherwise the underlying buffer(s) have to be recopied internally.
   *
   * A silent no-op on a disposed pool, which turns every vertex object away through
   * {@link containsVO}.
   */
  freeVO(vo: VO): void {
    if (!this.containsVO(vo)) return;

    const idx = VOUtils.getIndex(vo);
    const lastUsedIdx = this.usedCount - 1;

    if (idx === lastUsedIdx) {
      this.#voIndex[idx] = undefined;
    } else {
      this.buffer.copyWithin(idx, lastUsedIdx, lastUsedIdx + 1);
      const lastUsedVO = this.#voIndex[lastUsedIdx];
      // createFromAttributes(), fromBuffersData() and buffers data handed to the constructor
      // raise usedCount without materializing a vertex object, so the slot that is swapped down
      // can legitimately be empty
      if (lastUsedVO != null) {
        VOUtils.setIndex(lastUsedVO, idx);
      }
      this.#voIndex[idx] = lastUsedVO;
      this.#voIndex[lastUsedIdx] = undefined;
    }

    this.usedCount--;

    VOUtils.clearBuffer(vo);
  }

  /**
   * Puts the slots in use into the order of their keys — the draw order of the pool. `key` is one
   * of two things:
   *
   * - the **name of a value property** of the vertex objects: an attribute of one value on one
   *   vertex under its own name (`'rotation'`), or a component property (`'y'`, or `'x0'` on a vertex
   *   object of several vertices). The key of each slot is read straight from the buffer, so no
   *   vertex object is touched and no value crosses a call.
   * - a **key function** of the vertex object, called once per slot in use, in slot order, before
   *   anything moves (see {@link VOSortKey}). A slot that holds no vertex object yet — one filled
   *   through `createFromAttributes()`, `fromBuffersData()` or buffers data — gets one, as
   *   {@link getVO} gives it.
   *
   * The order is stable: equal keys keep the slot order they had. `descending` puts the highest key
   * first, and a `NaN` key goes last in either direction.
   *
   * Every buffer of the pool moves along, as whole vertex objects, and every vertex object keeps its
   * values and stays the same object: its index follows its slot, as it does when {@link freeVO}
   * moves the last vertex object. The slots from the first to the last that changed are marked for
   * upload in every buffer, the static ones included — a pool sorted every frame whose order changes
   * uploads about every buffer in full every frame. A sort that changes nothing marks nothing.
   *
   * The sort works on this pool alone: a pool attached to an instanced geometry beside this one
   * pairs its slots with these by index, and sorting one of them alone breaks the pairing — sort
   * both by the same keys with {@link sortByKeys}.
   *
   * The first sort allocates the scratch of the pool, which grows only with the capacity; every
   * later one allocates nothing. Does nothing on a disposed pool.
   *
   * @returns whether a slot moved; `false` on a disposed pool and with fewer than two slots in use
   * @throws when `key` names no value property — the message lists the ones there are —, and when the
   *   key function creates or frees a vertex object of this pool: the sort has moved nothing then,
   *   while what the key function did stands — a `freeVO()` has moved the last vertex object into
   *   the freed slot, as it always does. A key function that throws leaves the sort undone as well.
   *   `NaN` keys go behind every number, infinities included
   */
  sortBy(key: string | VOSortKey<VOType>, options?: VOSortOptions): boolean {
    if (this.isDisposed) return false;
    const n = this.usedCount;

    if (typeof key === 'string') {
      const layouts = (this.#valueLayouts ??= valuePropertyLayouts(this.buffer));
      const layout = layouts.get(key);
      if (layout === undefined) throw unknownSortKeyError(key, layouts);
      if (n < 2) return false;

      const keys = this.#prepareSort();
      const values = this.buffer.bufferList[layout.bufferIndex]!.typedArray!;
      const {stride, offset} = layout;
      for (let i = 0; i < n; i++) keys[i] = values[i * stride + offset]!;
    } else {
      if (n < 2) return false;

      const keys = this.#prepareSort();
      const vos = this.#voIndex;
      for (let i = 0; i < n; i++) {
        // asked before every slot: a slot the key function has freed lies beyond usedCount, and a
        // vertex object materialized there would sit in a slot out of use
        if (this.usedCount !== n) throw keyFunctionChangedPoolError(n, this.usedCount);
        let vo = vos[i];
        if (vo == null) {
          vo = this.#createVO(i, false);
          vos[i] = vo;
        }
        keys[i] = key(vo);
      }
      if (this.usedCount !== n) throw keyFunctionChangedPoolError(n, this.usedCount);
    }

    return this.#sortByOwnKeys(n, options?.descending === true);
  }

  /**
   * Puts the slots in use into the order of `keys`: `keys[i]` is the key of the vertex object in
   * slot `i`, for every slot below `usedCount`; the keys beyond are not read. The form for keys
   * worked out in bulk, as `FeatureSprites#sortByViewDepth()` does. The array is read, not written,
   * and still names the slots of before once the call returns.
   *
   * Everything else is {@link sortBy}: the order, what moves, what is marked for upload, the
   * scratch, a disposed pool.
   *
   * @returns whether a slot moved; `false` on a disposed pool and with fewer than two slots in use
   * @throws a `RangeError` that names both numbers when `keys` holds fewer keys than slots in use;
   *   nothing has moved then
   */
  sortByKeys(keys: ArrayLike<number>, options?: VOSortOptions): boolean {
    if (this.isDisposed) return false;
    const n = this.usedCount;
    if (keys.length < n) {
      throw new RangeError(
        `VertexObjectPool#sortByKeys(): ${keys.length} keys for ${n} vertex objects in use — hand in a key for every slot below usedCount`,
      );
    }
    if (n < 2) return false;

    const own = this.#prepareSort();
    for (let i = 0; i < n; i++) own[i] = keys[i]!;
    return this.#sortByOwnKeys(n, options?.descending === true);
  }

  /** The keys of the next sort, after the scratch of a sort has been made to fit the capacity. */
  #prepareSort(): Float64Array {
    const {capacity} = this;
    if (this.#sortKeys === undefined || this.#sortKeys.length < capacity) {
      this.#sortKeys = new Float64Array(capacity);
      this.#sortOrder = new Uint32Array(capacity);
      this.#sortMerge = new Uint32Array(capacity);
    }
    if (this.#sortVOs.length < capacity) {
      // filled, not holey: the slots below the capacity are all there, and each holds a vertex
      // object only while a sort moves it
      this.#sortVOs = new Array<(VOType & VO) | undefined>(capacity).fill(undefined);
    }

    // one copy for the largest buffer serves every buffer, each through a view of its own type;
    // rounded up to 8 bytes, which every view takes as a whole number of its elements
    const records = this.buffer.bufferList;
    let bytes = 0;
    for (let i = 0; i < records.length; i++) bytes = Math.max(bytes, records[i]!.typedArray!.byteLength);
    bytes = Math.ceil(bytes / 8) * 8;
    if (this.#sortScratch === undefined || this.#sortScratch.byteLength < bytes) {
      this.#sortScratch = new ArrayBuffer(bytes);
      this.#sortScratchViews.clear();
    }

    return this.#sortKeys;
  }

  #scratchView(dataType: VertexAttributeDataType): TypedArray {
    let view = this.#sortScratchViews.get(dataType);
    if (view === undefined) {
      view = scratchViewOf(dataType, this.#sortScratch!);
      this.#sortScratchViews.set(dataType, view);
    }
    return view;
  }

  /** Sorts the first `n` slots by the keys in `#sortKeys` and moves them; whether a slot moved. */
  #sortByOwnKeys(n: number, descending: boolean): boolean {
    const keys = this.#sortKeys!;
    const slots = this.#sortOrder!;
    // the sort compares ascending and takes no NaN: descending turns the keys over, the slots of a
    // number go to the front of the order, and the slots of a NaN behind them, in slot order — a NaN
    // would tie with an infinity if it were made one, and the stable order then put it in front
    let numbered = 0;
    for (let i = 0; i < n; i++) {
      const k = keys[i]!;
      if (Number.isNaN(k)) continue;
      if (descending) keys[i] = -k;
      slots[numbered++] = i;
    }
    for (let i = 0, nan = numbered; nan < n; i++) {
      if (Number.isNaN(keys[i]!)) slots[nan++] = i;
    }

    const order = sortSlotOrder(keys, slots, this.#sortMerge!, numbered);
    // the slots of a NaN stay where they were put; the merge may have left the sorted ones in the
    // other array
    if (order !== slots) {
      for (let i = numbered; i < n; i++) order[i] = slots[i]!;
    }

    // a sort every frame mostly finds most slots where they were: only the hull of the slots that
    // changed is moved and marked
    let first = 0;
    while (first < n && order[first] === first) first++;
    if (first === n) return false;
    let last = n - 1;
    while (order[last] === last) last--;

    this.#permuteBuffers(order, first, last);
    this.#permuteVOs(order, first, last);
    this.buffer.touch(first, last);
    return true;
  }

  /**
   * Gives the slot `i` of every buffer the values of the slot `order[i]`, for `first` ≤ `i` ≤ `last`.
   * The slots outside that range stay where they are, so the range maps onto itself.
   */
  #permuteBuffers(order: Uint32Array, first: number, last: number): void {
    const {vertexCount} = this.descriptor;
    const records = this.buffer.bufferList;
    for (let r = 0; r < records.length; r++) {
      const record = records[r]!;
      const values = record.typedArray!;
      const scratch = this.#scratchView(record.dataType);
      const stride = vertexCount * record.itemSize;
      const start = first * stride;
      const end = (last + 1) * stride;
      // element by element, not set(subarray()): subarray() allocates a view on every call
      for (let k = start; k < end; k++) scratch[k - start] = values[k]!;
      for (let i = first; i <= last; i++) {
        const from = (order[i]! - first) * stride;
        const to = i * stride;
        for (let j = 0; j < stride; j++) values[to + j] = scratch[from + j]!;
      }
    }
  }

  /** Moves the vertex objects as {@link #permuteBuffers} moves their values, and gives each its new index. */
  #permuteVOs(order: Uint32Array, first: number, last: number): void {
    const vos = this.#voIndex;
    const moving = this.#sortVOs;
    for (let i = first; i <= last; i++) moving[i] = vos[order[i]!];
    for (let i = first; i <= last; i++) {
      const vo = moving[i];
      vos[i] = vo;
      // the scratch holds no vertex object beyond the sort, which would keep a freed one alive
      moving[i] = undefined;
      if (vo != null) setVOIndex(vo, i);
    }
  }

  /**
   * The vertex object sitting in the slot `idx`, materialized on first access for a slot that
   * holds none yet — one filled through {@link VOBufferPool#createFromAttributes},
   * {@link VOBufferPool#fromBuffersData} or the buffers data handed to the constructor.
   *
   * Answers `undefined` for an index that is not an integer in `0` … `usedCount - 1`, and on a
   * disposed pool, which has no index left to look in: the declared type admits absence, and
   * the index went with {@link VOBufferPool#dispose}.
   *
   * The `voInitialize` hook does not run here: the slot keeps the data that
   * `createFromAttributes()`, `fromBuffersData()` or the buffers data handed to the constructor put
   * there.
   *
   * Nothing is marked for upload: reading a slot changes no data. Write through the vertex
   * object and call `touch()`, or give the attribute `autoTouch`.
   */
  getVO(idx: number): (VOType & VO) | undefined {
    if (this.isDisposed) return undefined;
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.usedCount) return undefined;

    let vo = this.#voIndex[idx];
    if (vo == null) {
      vo = this.#createVO(idx, false);
      this.#voIndex[idx] = vo;
    }
    return vo;
  }

  #createVO(idx: number, initialize: boolean): VOType & VO {
    const vo = createVertexObject<VOType>(this.descriptor, this.buffer, idx);
    // only a slot createVO() has just handed out is new; one getVO() materializes carries the
    // data createFromAttributes(), fromBuffersData() or buffers data put there, and the hook
    // would write over it without marking anything for upload
    if (initialize) vo[voInitialize]?.();
    if (this.onCreateVO != null) {
      return this.onCreateVO(vo) ?? vo;
    }
    return vo;
  }
}
