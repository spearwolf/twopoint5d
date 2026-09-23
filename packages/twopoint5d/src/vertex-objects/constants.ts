/**
 * The key of the property through which a vertex object reaches the `VertexObjectBuffer` it
 * reads and writes. `undefined` once its pool has let it go — through `freeVO()`, a `usedCount`
 * or a `resize()` that leaves its slot behind, or `dispose()`. `VOUtils` reads and writes it.
 */
export const voBuffer = Symbol('voBuffer');

/**
 * The key of the property that holds the slot of a vertex object in its buffer, which is where
 * its values start. `freeVO()` moves the last vertex object of a pool into the slot it frees, so
 * the index of a vertex object can change while it lives. `VOUtils` reads and writes it.
 */
export const voIndex = Symbol('voIndex');

/**
 * The key of an optional method on the `basePrototype` of a description: the hook that fills a
 * slot a pool has just handed out.
 *
 * `VertexObjectPool#createVO()` calls it once for every slot it hands out, with the new vertex
 * object as `this` and no arguments, after the vertex object is linked to its buffer and slot and
 * before `onCreateVO` runs; its return value is ignored. It does not have to mark anything for
 * upload — `createVO()` marks the slot once the hook has run.
 *
 * It runs nowhere else: a vertex object `getVO()` materializes for a slot filled through
 * `createFromAttributes()`, `fromBuffersData()` or buffers data handed to the constructor keeps the
 * data that was put there. The hook belongs on the `basePrototype`; `methods` is read by its
 * string keys, so a symbol key there never reaches a vertex object.
 */
export const voInitialize = Symbol('voInitialize');
