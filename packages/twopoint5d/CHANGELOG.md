# CHANGELOG

All notable changes to [@spearwolf/twopoint5d](https://github.com/spearwolf/twopoint5d/tree/main/packages/twopoint5d) will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- add `CameraBasedVisibility#pointsOnPlane`: the points where the probe rays of the view frustum met the map plane, in probe order. It is empty for a recomputation in which the camera looked past the plane, and its first entry is the point `pointOnPlane` carries. The `Vector3`s belong to the visibility and are written again on the next recomputation. `CameraBasedVisibilityHelpers` marks each of them, the first one as before and the further ones smaller and in blue
- add the `VOBufferPool#isAttachedToGeometry` getter: it is `true` while at least one geometry has built `THREE.BufferAttribute`s on top of the pool's buffers, and answers up front whether a `resize()` will go through. It is `false` on a disposed pool, which has no buffers left for a geometry to read, whether or not one still holds it — the bookkeeping underneath is left as it is, so a geometry that gives the pool up afterwards still counts down correctly
- add `AnimatedSpritesMaterial#touchAnimsMap()`: re-reads the `animsMap` texture and rebuilds the animation lookup from its current image
- export the `AnimatedSpritesMaterialParameters` interface: a consumer can name the option type of the `AnimatedSpritesMaterial` constructor, as with every sibling material
- export 30 types that stood in public signatures without being nameable from outside — a consumer can now write the type of a value the library hands out, instead of inferring it. Among them `InputControlBase`, `FrameLoop`, `DisplayEventListener`, `ISetAnimationLoop`, `OnRAF`, `TileBox`, `Quadrant`, `IChunkQuadTreeChildNodes`, `StringDataIdsChunk2DParams`, `Uint32DataIdsChunk2DParams`, `StageItem`, `AnimName`, `TextureAtlasArgs`, `TextureAtlasFrameName`, `NamedTextureAtlasArgs`, `TextureResourceSubTypeMap`, `MapTuple`, `MapSubTypes` and `TouchInstancedBuffersType`. The loader callback types keep their meaning under clearer names: `PowerOf2ImageLoadCallback`, `TextureAtlasLoadCallback`, `TextureImageLoadCallback`, `TileSetLoadCallback` and their `…ErrorCallback` siblings
- add `Display#isDisposed`: `true` once `dispose()` has run, so a caller holding a display it did not create has a question it can ask
- add the `evictMissing` option to `TextureStore#parse()` and `TextureStore#load()`, carried by the exported `TextureStoreParseOptions`: with `{evictMissing: true}` a parse disposes and removes every resource the new data no longer names and whose `refCount` is 0. `refCount` counts the live `TextureStore#on()` subscriptions of a resource — a value fetched through `TextureStore#get()` does not raise it, because that promise gives its subscription up as it settles, so a texture sitting in a material counts for nothing here; a caller who wants to keep such a value keeps a subscription as well. The option defaults to `false`, which keeps every resource until `TextureStore#clearUnused()` is called — `clearUnused()` still sweeps the whole store, `evictMissing` only the resources that fell out of the data
- add the static `FrameLoop.resetRAF()`: it drops the rAF drivers all `FrameLoop`s of the module share, so the next loop starts on a fresh frame counter and an unmeasured fps — for test files that build several loops in one worker
- add `StageRenderer#isDisposed`: `true` once `dispose()` has run, so a caller holding a renderer it did not create has a question it can ask
- add `Canvas2DStage#dispose()` and `Canvas2DStage#isDisposed`: the stage releases the sprite material, both textures that ever sat behind it and the `StageRenderer` it built in its constructor — everything it created itself. The `WebGPURenderer` and a canvas handed to the constructor belong to the caller and are left as they are, and the geometry every `THREE.Sprite` of the module shares is not this stage's to release. A `dispose` event goes out to every subscriber before the stage stops listening. Afterwards `isDisposed` is `true`, `texture` answers `undefined`, and `render()`, `setCanvasSize()`, `setContainerSize()`, a write to `fit` and a second `dispose()` do nothing. The rules behind this are written down in [docs/resource-lifecycle.md](https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/docs/resource-lifecycle.md)
- add `InputControlBase#dispose()` and `InputControlBase#isDisposed`: `dispose()` takes every listener the control put on a host back off again — the hosts themselves are handed in and stay the caller's — and puts the control out of service. Afterwards `isDisposed` is `true`, `isActive` is `false`, and the control cannot be brought back: `subscribe()`, a write of `true` to `isActive` and every `addEventListener()` of a subclass do nothing. `destroyAllListeners()` is unaffected and stays what it is, a reset after which a control takes listeners again. The rules behind this are written down in [docs/resource-lifecycle.md](https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/docs/resource-lifecycle.md)
- add the `coordsTarget` option and the `PanControl2D#coordsTarget` field: the element every pointer position is measured against, through its `getBoundingClientRect()`. It defaults to the `cursorStylesTarget`, and with that to `document.body`. A canvas inside a shadow root belongs here, because the browser retargets `event.target` onto the shadow host there
- add the `error` event of `Display`, the `Display#onError()` shorthand and the exported `OnDisplayError` constant: a renderer that does not come up reports the reason through it. The event is retained, so a listener attached after the failure — the normal case, since the constructor returns before the renderer is ready — is told about it as well
- add `TextureFactory#loadAsync()` and the `TextureLoadOptions` object `TextureFactory#load()` takes in front of its texture classes. `loadAsync(url, textureClasses?)` gives back the promise of the three.js loader and applies the classes to the texture it resolves with, so a load that fails rejects. `load(url, {onError}, ...classNames)` reports the same failure through the callback it is given; without options it is the call it always was. The options carry that one callback: three.js reports no progress for a texture load, because `TextureLoader` passes the progress callback on to `ImageLoader`, which never calls it
- add `FrameBasedAnimations#hasAnimation()`: whether an animation is registered under a name. It is the question to ask before `animId()` when the name comes from outside
- add a `RegExp` form to the `frameNameQuery` of `FrameBasedAnimations#add()`: beside a string pattern it takes a regular expression — both forms `TextureAtlas#frameNames()` accepts, and both narrow the animation to the frames whose names match
- add a shared image cache to `TextureStore`: resources that name the same `imageUrl` are served by one fetch for as long as at least one of them wants it. What is shared is the image and not the texture — every resource applies its own texture classes and owns the `Texture` it built. The entry goes as the last resource lets go of it, so a resource created afterwards fetches the image again, and a load that failed is not kept either

### Changed

- `TextureAtlas#add()` refuses a frame name that is already taken and throws an error naming it; the atlas keeps the frame it registered under that name, and the refused frame is not added. A name belongs to exactly one frame, as it already did in `FrameBasedAnimations#add()`
- an animation built from a `TextureAtlas` takes the frames carrying a string name, in the order a numeric collation of those names puts them: `walk.2` runs before `walk.10`, so a sequence numbered without padding plays as it reads. Names that collation ranks equal — `walk.01` beside `walk.1` — keep the order the atlas registered them in. Frames registered under a symbol stay out — a symbol has no place in an ordered sequence, and an atlas that holds one can be turned into an animation as a whole
- `FrameBasedAnimations#animId()` throws an error naming the animation that is missing. The id goes straight into a typed vertex-object buffer, where an absent value would quietly become `NaN` and the sprite reading it would go invisible; `hasAnimation()` is the way to test a name first
- an animation entry of a `TextureResource` whose timing does not let the animation be built — neither `duration` nor `frameRate`, or a `frameRate` of 0 — is skipped and reported through the same `error` event as an entry of the wrong shape, with `{source: 'frameBasedAnimations', id, animation, error}`. Every other entry of the map is registered all the same
- `TextureAtlasLoader` checks the response of an atlas url against the shape of a texture packer json before it reads it, and it checks as deep as it reads: every frame entry carries a `frame` with four numbers, and `meta.size` carries `w` and `h` as numbers. A response that is none reaches the error callback — and `loadAsync()` rejects — with a message naming the url, and no image is fetched for it. The image url is a question of its own: a json that names none is refused the same way, unless an `overrideImageUrl` says where the image is. The `meta` handed to the caller names the image the texture was built from, so `meta.image` carries the `overrideImageUrl` wherever one was given
- `imageCoords`, `atlas`, `tileSet`, `texture` and `frameBasedAnimations` of `TextureResource` are read-only. They are what the effects of `TextureResource#load()` produce out of the values that were written to the resource; the class documentation says which properties are input and which are output
- `TextureResource#atlasUrl`, `#atlasJson`, `#overrideImageUrl` and `#tileSetOptions` belong to one kind of resource each and throw a `TypeError` naming resource, kind and property when they are written on another kind. On a disposed resource a write to any of them still does nothing
- `TextureResource#imageUrl` is input on an image and a tile set resource and output on an atlas resource, where it follows `overrideImageUrl ?? atlasJson.meta.image`. A write on an atlas resource throws a `TypeError` that names the resource and points at `overrideImageUrl` — the way to send such a resource to another image without leaving its atlas behind on the one before. On a disposed resource the write does nothing, as with every other setter
- change the return type of `TextureStore#load()` to `Promise<TextureStore>`. It resolves with the store once the attempt is over and never rejects: every failure along the way goes out as an `error` event. Resolving says the attempt is done, not that it worked — `whenReady()` is what answers that
- `TextureStore#on()` delivers only values that are there: a subtype that is cleared and announces it does not reach the callback, and for several subtypes the callback waits until each of them has a value again. `TextureStore#get()` inherits this and cannot resolve with an `undefined` where its type promises a value. For several subtypes the callback is called once per tuple: the values that belong together change in one go, and a tuple in which every value is the one the last call carried is not delivered again
- both fetch paths check the status of the response before they parse it: `TextureStore#load()` for the catalog and the atlas effect of `TextureResource` for the atlas json. A response that answers with a status becomes an `error` event carrying the new `status` field — `source: 'fetch'` at the store, `source: 'atlas'` at the resource
- `TextureStore#parse()` holds every item against what is already there before it writes the first one. Items whose type conflicts with an existing resource are collected and reported in one error that is thrown before anything is written or emitted, so a parse either runs whole or not at all. An item that names neither a `tileSet`, an `atlasUrl` nor an `imageUrl` builds no resource and says so through an `error` event with `source: 'parse'` and its `id`; the static `TextureStore.load()` rejects on it
- an animation entry of a `TextureResource` whose data does not fit the kind of resource — a frame name query on a tile set, a tile range or tile ids on an atlas, an entry that names no frames at all — is skipped and reported through an `error` event with `{source: 'frameBasedAnimations', id, animation, error}`
- an atlas and the texture beside it always describe the same image: the atlas effect of a `TextureResource` publishes only when the coordinates it builds on belong to the image its json names, the effects that derive from an image run at a higher priority than the bridges that carry the values out as events, and a subscriber of `TextureStore#on(id, ['atlas', 'texture'], …)` is called with values read off the resource rather than with the last value each event carried. While an atlas resource is on its way to another image the atlas of the one before stays published — it is never cleared, because the event promises a `TextureAtlas`
- `CameraBasedVisibility` looks for the map plane along nine rays through the view frustum instead of one: its center, the middle of its bottom, left, right and top edge, and its four corners, tested in that order. As long as the camera looks at the plane the center ray finds it first and the result is the one it produced alone; when the center of the view points past the plane — a camera tilted up at the horizon, one that has the ground in the lower half of its picture only — the tiles that are in the view are found instead of nothing at all. Only a view frustum that meets the plane with none of the nine rays reports no tiles. The `far` value of the camera still limits how far along a ray the plane is looked for; each ray now starts at the near plane
- perf `CameraBasedVisibility#computeVisibleTiles()`: when three or more rays meet the plane, every tile within the convex hull of the tiles they met goes into the visible set without being held against the view frustum, and the tile-by-tile search runs from the border of that area outwards. The area where a frustum meets a plane is convex, so each of those tiles reaches into the view — the tile set is the one the search alone arrives at, and the frustum tests it would have spent on the inside of the area are saved. Fewer than three rays span no area, and everything is searched as before
- `TileBox#primary` marks the tiles of every probe ray that met the plane instead of the tiles under the center of the view alone — per ray the tile its point fell into together with the ones a rectangle of one tile size around that point reaches, as before. A tile marked this way keeps the mark even when the search reaches it again as the neighbour of another tile, which it did not before: of the tiles under the center of the view usually only one kept it
- upgrade the `@spearwolf/eventize` peer dependency to `^6.2.0` (was `^5.0.0`) and `@spearwolf/signalize` to `^1.0.0` (was `^0.30.0`) — both are major releases, and `signalize@1.0.0` requires `eventize@^6.0.0`, so the two only move together
- `TexturedSpritesMaterial` and `TileSpritesMaterial` now pass the TSL node type to `attribute()` explicitly (`attribute<'vec3'>(…)` instead of `attribute(…)`); the stricter `createSignal()` overloads no longer accept the untyped `AttributeNode<unknown>` these calls returned. No runtime change — the shader attributes were already used at these types
- `TexturedSpritesMaterial#dispose()` and `TileSpritesMaterial#dispose()` call `SignalGroup.delete()` instead of the deprecated `SignalGroup.destroy()`, which now prints a deprecation notice once per process
- change the return type of `VertexObjectPool#createVO()` to `(VOType & VO) | undefined` — the method returns `undefined` once `usedCount` has reached `capacity`
- `VertexObjectPool#resize()` throws for every change of capacity while the pool backs a geometry — resizing to the capacity the pool already has stays a no-op and is allowed. The `THREE.BufferAttribute`s and their GPU buffers take their size from the pool capacity exactly once, so a live geometry cannot follow a capacity change
- `VOBufferGeometry#dispose()` and `InstancedVOBufferGeometry#dispose()` release exactly the pools the geometry created itself, and leave every pool that was handed to the constructor untouched. Both also take the attributes built on the pool buffers off the geometry and drop the index, so nothing keeps the typed arrays alive through the geometry; attributes copied from a `BufferGeometry` passed to `InstancedVOBufferGeometry` stay where they are, because they belong to the caller. A further `update()` on a disposed geometry finds no attributes left to write to — it still sets the draw range and, on `InstancedVOBufferGeometry`, `instanceCount`
- `InstancedVOBufferGeometry#detachInstancedPool()` takes the attributes that route built off the geometry, and disposes a pool that belongs to the geometry as its last route from that geometry goes away. The pool is still returned, so a caller who wants to look at it can. Attaching over a name that is already taken runs the same path — the attributes of the route it replaces come off with it — and the pool taking the name over needs attribute names of its own. Handing the same pool back under the name it already has keeps everything it has. A material whose shader still reads an attribute of the detached route cannot render the geometry any more; disposing the geometry goes through.
- the `autoDispose` option of `InstancedVOBufferGeometry#attachInstancedPool()` defaults to whether the geometry built the pool itself: a descriptor or description handed in becomes a pool the geometry releases with itself, an existing `VertexObjectPool` stays the caller's. An explicit `autoDispose` still decides
- `TexturedSprites#createSprite()` and `#freeSprite()` are methods on the mesh and operate on its geometry's sprite pool; `createSprite()` returns `TexturedSprite | undefined` and answers `undefined` once the pool has reached its capacity
- `float16` attributes are backed by a `Float16Array`; a value written through the generated accessors is stored and read back as a half float. The `TypedArray` union lists `Float16Array` and every other type exactly once. A runtime without `Float16Array` throws on the first `float16` attribute; every other data type is unaffected
- the generated multi-component setters and `VertexObjectBuffer#copyAttributes()` copy element by element and allocate nothing per vertex
- `InstancedVOBufferGeometry#attachInstancedPool()` is generic over the vertex object type and returns `VertexObjectPool<VOType>`; without a type argument the returned pool is typed `VertexObjectPool<unknown>`
- a descriptor or description passed to `InstancedVOBufferGeometry#attachInstancedPool()` is wrapped in a pool that has the capacity of the geometry's `instancedPool`
- `TexturedSprites#spritePool` is typed `TexturedSpritePool | undefined` and `#texture` is typed `Texture | undefined`: after `dispose()` the mesh holds neither geometry nor material, `spritePool` and `texture` answer `undefined`, `createSprite()` answers `undefined`, and `freeSprite()` and a write to `texture` do nothing
- `VO[voBuffer]` is typed `VertexObjectBuffer | undefined`: a vertex object whose pool has let it go, through `freeVO()` or `dispose()`, reaches no buffer any more — the type `VOUtils.getBuffer()` answers with
- change the return type of `getDescriptorOf()` to `VertexObjectDescriptor | undefined`: a vertex object without a buffer has no descriptor to answer with
- `VertexObjects#geometry` is typed `GeoType | undefined` and `#material` `Material | Material[] | undefined`: the constructor takes both as optional, and `AnimatedSprites#dispose()` and `TexturedSprites#dispose()` give both up
- `VertexObjects` extends `THREE.Mesh<any, any>`: neither type parameter of `THREE.Mesh` can carry the `undefined` that the `geometry` and `material` declarations of this class need. Both slots are re-declared in the class itself, and those declarations are the types it shows
- change the return types of `TextureAtlas#randomFrame()` and `#randomFrameName()` to `TextureAtlasFrame | undefined` and `TextureAtlasFrameName | undefined`, and those of `#randomFrames()` and `#randomFrameNames()` to arrays of the same: an atlas without frames, or without named frames, has nothing to draw
- a lookup whose result an invariant guarantees — an attribute descriptor, the claim on an attribute slot, the buffers of a pool attached under a name — throws an error naming what was missing when that invariant is broken, at the place that relies on it
- `OrthographicProjection#viewSpecs` is typed `Partial<OrthographicProjectionSpecs>`, the same type `ParallaxProjection#viewSpecs` carries, and `projectionPlane` on both classes and on the `IProjection` interface is typed `ProjectionPlane | undefined`. Both constructor arguments are optional, and a projection built without them holds exactly what these types name
- the `Map2D#visibilitor` getter is typed `IMap2DVisibilitor | undefined`: a map that has not been given a visibilitor answers with nothing. The setter still takes an `IMap2DVisibilitor`
- `Map2DTileRenderer#tileFactory` is typed `IMapTileFactory | null` and holds `null` once `dispose()` has run. The six update-cycle methods — `beginUpdatingTiles()`, `addTile()`, `reuseTile()`, `removeTile()`, `clearTiles()` and `endUpdatingTiles()` — do nothing on a disposed renderer and none of them throws; `beginUpdatingTiles()` leaves `node` where it stands. `dispose()` gives every tile the renderer still holds back to the factory through `destroyTile()` and takes the factory content out of `node`; it releases nothing of its own, because the factory is handed to the constructor and stays the caller's. A second `dispose()` does nothing. The rules behind this are written down in [docs/resource-lifecycle.md](https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/docs/resource-lifecycle.md)
- `Map2D#dispose()` releases nothing — the tile renderers, the visibilitor and a `Map2DTileStreamer` handed to the constructor all belong to the caller, and a renderer that should go is disposed by whoever created it. The map takes every renderer off itself and leaves the scene graph; every one of its members answers afterwards as it did before, and a second call does nothing. The rules behind this are written down in [docs/resource-lifecycle.md](https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/docs/resource-lifecycle.md)
- `TileSpritesMaterial#dispose()` gives up its `colorMap`, so it answers `undefined` afterwards; the texture itself is not released, it belongs to the caller. The node accessors typed as always present keep their last node
- `CameraBasedVisibility#pointOnPlane` is typed `Vector3 | null | undefined`: `null` marks a plane the camera looks past, `undefined` a point that was never computed
- change the return type of `DataIdsChunk2D#readDataIdAt()` and `#readDataIdAtLocal()` to `number | undefined` — coordinates outside the chunk have no data id
- `TextureResource.fromTileSet()` takes `imageUrl` as `string | undefined`, the type the resource stores it at. `TextureStore#parse()` hands the value of an item straight through, and that value is optional
- `FrameBasedAnimations#add()` throws when its third argument is neither a `TextureAtlas`, a `TileSet` nor an array of frames; the message names what that argument has to be, and no animation is registered
- the `typedArray` of a buffer in `VertexObjectBuffer#buffers` is typed `TypedArray | undefined`: `VOBufferPool#dispose()` takes every buffer its array and clears the same map in the same breath, so the field is empty only in a reference that was grabbed before that call
- change the return type of `VertexObjectBuffer#toAttributeArrays()` to `Record<string, TypedArray | undefined>` — an attribute name the descriptor does not know gets an entry without an array
- change the return type of `FrameLoop#start()` to `(() => void) | undefined`: a missing `target`, or one already running on the loop, gets no second unsubscribe function
- upgrade the `three` peer dependency to `~0.185.1` (was `~0.183.1`) and `@types/three` to `~0.185.4`. Under the new types `vec3()` no longer accepts an `AttributeNode<unknown>` in any overload: a bare `attribute('name')` passed into a TSL constructor needs its type argument, as in `attribute<'vec2'>('quadSize')`
- `DisplayRendererParameters` names the 17 options it carries instead of being the empty type `{}`. An object literal handed to the `Display` constructor is now checked against them; an unknown key is an error where it used to pass unnoticed
- `TexturedSprites#dispose()` releases exactly the geometry and the material the mesh built for itself, and leaves a `TexturedSpritesGeometry`, a `TexturedSpritesMaterial` or a `Texture` handed to the constructor untouched — those belong to the caller. The mesh also takes itself out of the scene graph before it gives both slots up. The rules behind this are written down in [docs/resource-lifecycle.md](https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/docs/resource-lifecycle.md)
- `AnimatedSprites#dispose()` releases neither the geometry nor the material: this mesh builds neither of them, both are handed to its constructor and stay the caller's. It takes itself out of the scene graph and gives both slots up
- `AnimatedSpritesMaterial#dispose()` leaves the `animsMap` texture alone — it is handed in through the constructor options or the setter and belongs to the caller. `animsMap` answers `undefined` afterwards
- `TexturedSpritesMaterial#dispose()` gives up its `colorMap` and its `texCoordsNode`, so both answer `undefined` afterwards; the `colorMap` texture itself is not released, it belongs to the caller. The node accessors typed as always present keep their last node
- a `Display` states what it is after `dispose()`: `renderer` answers `undefined` and `isDisposed` answers `true`; `canvas`, `start()` and `getEventProps()` throw an error that names the class and the state; `resize()`, `renderFrame()`, `stop()`, a write to `pause` and a further `dispose()` do nothing, and the `pause` getter keeps reading the state the display was left in; `width`, `height`, `frameNo`, `now` and `deltaTime` keep their last value, `isRunning` is `false`, and `isWebGPUBackend` and `isWebGLBackend` throw because the renderer they ask about is gone. No further event is emitted, and a listener attached afterwards is never called. The rules behind this are written down in [docs/resource-lifecycle.md](https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/docs/resource-lifecycle.md)
- `TextureStore#get()` rejects an id that is still missing once the first `parse()` has gone by, with the same error `TextureStore#whenResource()` throws, instead of waiting for a later `parse()`. A subscription through `TextureStore#on()` still waits
- `TextureResource#dispose()` releases the texture the resource built for itself. Afterwards every getter of the resource answers `undefined`, while `id` and `type` still say which resource this was, and a write to a setter, a `load()` and a second `dispose()` do nothing. The rules behind this are written down in [docs/resource-lifecycle.md](https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/docs/resource-lifecycle.md)
- a second `TextureStore#dispose()` does nothing: the dispose event goes out once, and the renderer handed to the constructor is never disposed — it belongs to the caller. That dispose event is also the last event the store emits; afterwards `renderer` and `textureFactory` answer `undefined`, `parse()`, `load()`, `on()`, `onResource()` and a write to `renderer` do nothing, and `defaultTextureClasses` keeps its last value — a configuration array is no resource, and the answer stays right
- an attribute slot of an `InstancedVOBufferGeometry` belongs to one route for the whole life of the geometry: `attachInstancedPool()` throws when an attribute of the pool would take a slot this geometry has already had an attribute in, and the geometry is left exactly as it was. The message names the call and the slots it is about. The base route, the instanced route and the attributes copied from a `BufferGeometry` handed to the constructor may still share a name — until the constructor returns, no attribute of the geometry has reached the renderer. Handing the same pool back under the name it already has changes nothing: every attribute stays where it is, and an `autoDispose` passed along with it still takes effect
- `StageRenderer#dispose()` releases the `RenderTarget`s the renderer built for itself, and nothing else: a `pipeline`, an `outputRenderTarget` and every stage were handed in and stay the caller's. The renderer takes its stages off itself and lets go of the host that drives it, so no further frame reaches it. Afterwards `isDisposed` is `true`, `parent` and `pipeline` answer `undefined`, `stages` is empty, and a write to `parent`, `attach()`, `add()` and a second `dispose()` do nothing. The rules behind this are written down in [docs/resource-lifecycle.md](https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/docs/resource-lifecycle.md)
- `FixedFrameLoop#dispose()` leaves the `Display` it was handed exactly as it found it: the display is not disposed, and it keeps only the subscriptions it carried before the loop was built. `fixedDelta`, `tickTime`, `tickNo` and `alpha` keep the values the loop was left with, `fps` and `maxStepsPerFrame` stay writable and no tick reads either one again (a write to `fps` recomputes `fixedDelta` with it), `reset()` and a second `dispose()` do nothing, and a handler subscribed through `onTick()` or `onRender()` afterwards is never called
- `VOBufferPool#toBuffersData()` and `#fromBuffersData()` throw on a disposed pool, with a message naming the class, the method and the state. The return type of `toBuffersData()` promises the buffers of a live pool, and a disposed one has none to answer with; `fromBuffersData()` turns away a capacity it cannot serve, as it already does for a capacity that does not match its own. `VertexObjectPool` inherits both
- a disposed `VOBufferPool` hands out nothing and cannot be brought back into service: `createFromAttributes()` and `VertexObjectPool#resize()` throw with a message naming the class, the method and the state, `VertexObjectPool#createVO()` answers `undefined` without counting the refused slot, and `availableCount` is `0`. The object count of `createFromAttributes()` cannot tell a spent pool from a full one, and a `resize()` that allocated fresh buffers would put a disposed pool back to work — both refuse instead. `VertexObjectPool#getVO()` answers `undefined` for every index, whatever `usedCount` says at the time, `clear()` and `freeVO()` go on doing nothing, and `capacity`, `descriptor` and `usedCount` keep saying what this pool is. A write to `usedCount` or to `buffer` falls through, so `usedCount` goes on answering `0` and `buffer` goes on answering the buffer the pool was disposed with, and `VertexObjectPool#containsVO()` answers `false` whatever a vertex object points at, which keeps `freeVO()` the no-op it says it is. `buffer` is an accessor pair on the prototype now; reading and writing it on a live pool is unchanged
- the rAF driver every `FrameLoop` of the module shares runs exactly as long as at least one `FrameLoop` has subscribers, and it picks its work back up by itself when one comes back. A `FrameLoop` without subscribers asks for no frames, and the fps measurement anchors a fresh window on the tick that resumes it
- a disposed `StageRenderer` builds no further `RenderTarget`: `asPassNode()` throws an error naming the class and the state instead of handing out a node backed by a target nothing would release again, `renderTo()` does nothing — it neither draws nor clears the caller's target — and a write to `pipeline` falls through, so the getter keeps answering `undefined`. `pipeline` is an accessor pair on the prototype now; reading and writing it on a live renderer is unchanged
- `StageRenderer#remove()` clears both sides of the relation: a removed child `StageRenderer` answers `undefined` as its `parent` afterwards and gets its `OnRemoveFromParent`, exactly as a `parent = undefined` on the child would do. A listener reading `renderer.parent` from that event sees `undefined` — the event says the child has been removed
- the `VertexObjectBuffer` behind a disposed pool says which state it is in: `copy()` from it, `copyArray()`, `copyAttributes()` and `toAttributeArrays()` throw an error naming the class, the method and the state instead of a `TypeError` from somewhere inside, and `clone()` and the constructor refuse it as a source rather than answering a second buffer without data. `copyWithin()` and `touch()` do nothing, and `descriptor`, `capacity`, `attributeNames`, `bufferAttributes` and `bufferNameAttributes` go on saying what this buffer was. `copyArray()` with a buffer name the buffer does not know says exactly that, so a typo is not read as a dispose
- a disposed pool is turned away at the door: the `VOBufferGeometry` and `InstancedVOBufferGeometry` constructors and `InstancedVOBufferGeometry#attachInstancedPool()` throw when they are handed one, with a message naming the call and the state. A pool without buffers gives a route no attributes, and a geometry built over one draws nothing while looking like any other
- `FrameLoop.OnFrame` and the exported `OnRAF` are `Symbol.for('twopoint5d:FrameLoop.OnFrame')` and `Symbol.for('twopoint5d:FrameLoop.OnRAF')`: the keys carry the library namespace, so no other code in the realm reaches the same channel by asking the symbol registry for a name as common as `onFrame`. Code that subscribes through the exported constants needs no change; code that rebuilds the key from its string does — see the migration guide
- a `createRenderer` callback receives only renderer options in its `params`: `maxFps`, `resizeTo`, `resizeToElement`, `resizeToAttributeEl`, `styleSheetRoot` and `createRenderer` stay with the display. `CreateRendererParameters` names none of them
- `PanControl2D` emits `restoreCursor` for a cursor it hid, and takes the cursor class off the target then. A pointer moving over the page with no button down passes through without an event
- a value written to `Map2DTileStreamer#tileWidth`, `#tileHeight`, `#xOffset` or `#yOffset`, and with it to the same four properties of `Map2D`, builds the tiles again: the next `update()` clears every renderer and lets the visibilitor lay out the whole set in the new grid. A tile is recognised by its `(x, y)` id and would otherwise come back as a reuse, where `IMapTileFactory#updateTile()` writes only its position — the sprite would go on showing the size and the texture coordinates of the grid it was built in. Writing the value a property already holds costs nothing
- `RectangularVisibilityArea#computeVisibleTiles()` removes the tiles of the previous call instead of reusing them when the `Map2DTileCoordsUtil` it is given describes another grid than the one before. It takes the grid as an argument and can be driven without a `Map2DTileStreamer`, so it guards the case on its own
- `CameraBasedVisibility#computeVisibleTiles()` removes the tiles of the previous call instead of reusing them when the `Map2DTileCoordsUtil` it is given describes another grid than the one before, and lays the new grid out on tile objects of its own. It takes the grid as an argument and can be driven without a `Map2DTileStreamer`, so it guards the case on its own
- `CameraBasedVisibility#frustumBoxScale` is part of the state a recomputation is held against: a value written to it at runtime reaches the next `computeVisibleTiles()`, which reports `changed: true` and raises `serial`, instead of waiting for the camera to move
- `CameraBasedVisibility#visibles` is empty after a recomputation in which none of the probe rays met the plane. The visibility helpers read the list, and would otherwise draw tile boxes for a view that no longer exists
- `CameraBasedVisibilityHelpers#maxDebugHelpers` limits the frustum box helpers that were built, not the tiles the walk passed on the way: with the value at 9, nine such helpers are built wherever the visible tiles are sorted. The number covers the frustum boxes of the tiles no probe ray met directly; the frustum boxes of the primary tiles and the tile boxes follow the number of visible tiles, as they always did
- `RepeatingTilesProvider#tileIds` takes a rectangular pattern only: every row has the length of the first one, and a pattern without a row is none at all. A pattern that breaks either rule is refused with an error naming the row and its length, and the provider keeps the pattern it holds — the width of a pattern describes the whole of it, and a row shorter than that has no id to answer with where the signature promises a `number`
- `Map2D#tileStreamer` hands the view center over to the streamer that takes over — `centerX` and `centerY` read the same values afterwards as before — and has the tiles built again: the renderers of the map are cleared on the next `update()` and the streamer taking over lays out the whole set. The tile grid stays with the streamer that carries it, `tileWidth`, `tileHeight`, `xOffset` and `yOffset` among it
- `DataIdsChunk2D#prepareData()` names the compression it cannot handle in the error it throws and writes nothing to the console: the caller reads the reason off the error, in a message that cannot be silenced away
- perf `Map2DTileRenderer` asks the factory once for a tile it declined to build. The answer stands until that tile is removed or `clearTiles()` runs, so a map with holes no longer costs one tile-data lookup per hole and per frame
- perf `Map2DTileRenderer#clearTiles()` on a renderer that held no tile raises no data serial, so the following `endUpdatingTiles()` sends no attribute buffers to the GPU
- perf `Map2D#update()` leaves the world matrix to the tile streamer, which brings it up to date with `updateWorldMatrix(true, false)` — the parent chain first — on every update that has a visibilitor and a tile renderer to lay out tiles for. An update that is missing either of the two touches no matrix, and the three.js renderer brings the scene graph up to date before it draws

### Removed

- remove `VertexObjectPool#onDestroyVO`: `freeVO()` and `dispose()` release a vertex object without firing a callback. `onCreateVO` is unchanged
- remove `TileSpritesFactory#freeTileSprite()`: `destroyTile()` gives a tile sprite back to the pool, and is the call `IMapTileFactory` names

### Fixed

- fix the published type declaration of `texture/TextureResource`: it imported `./types.ts` with the suffix of the source instead of `./types.js`, an extension that does not exist in the package
- fix the tile coordinates `CameraBasedVisibility` computes for a map whose `xOffset` or `yOffset` lies outside the first tile: the view rectangle of a tile, the box it is tested with and the tiles the search walks on to are the ones of the tile coordinate they belong to. The query these are derived from was handed a coordinate without the map offset while it reads one with it, which shifted every tile of such a map by `floor(-offset / tileSize)` tiles against the tile coordinate it was found under. An offset within the first tile — the usual `-tileSize / 2` among them — was and is unaffected
- fix `VertexObjectPool#freeVO()`: the vacated slot is cleared on both the last-index and the swap path, so a freed index holds no vertex object — `getVO()` on it returns `undefined` and the internal index keeps nothing alive
- fix `VertexObjectPool#freeVO()`: the swap path tolerates an index slot that `createFromAttributes()` raised `usedCount` past without materializing a vertex object
- fix `VertexObjectPool#resize()`: shrinking unlinks every vertex object from the new capacity onwards, so a later read or write on one of them fails loudly
- fix the `VOBufferPool#usedCount` setter: the value is clamped to `[0, capacity]`, which keeps `availableCount` within `[0, capacity]` and every index handed out by `createVO()` inside the buffer. Every writing path — `clear()`, `createFromAttributes()` and `fromBuffersData()` — goes through the setter, so the clamp is an invariant of the class. `dispose()` sets the count straight on the field, because it is the write that makes the pool a disposed one, and the `0` it writes lies in `[0, capacity]` like any other
- fix the upload range of every geometry attribute: it spans `itemSize * vertexCount * usedCount` elements, so a pool with a `vertexCount` above `1` — quads built through `VertexObjectGeometry`, for instance — uploads every vertex of every object it has in use
- fix `VOBufferGeometry#update()` and `InstancedVOBufferGeometry#update()` for a pool that was disposed while the geometry still reads it: the buffers of such a pool are gone, and the geometry leaves the attributes built on them alone
- fix `InstancedVOBufferGeometry#update()` for the `[pool, capacity, BufferGeometry]` constructor variant: an attribute that none of the geometry's pools declares stays as it is. That is what the attributes copied from the given `BufferGeometry` need — they belong to the caller, and this constructor path has no base pool to resolve them against
- fix `InstancedVOBufferGeometry#detachInstancedPool()` and both `dispose()` methods: giving up a route removes exactly the attributes that route put on the geometry, even when two pools share their typed arrays or declare the same attribute name. A pool is therefore safe to `resize()` once its last route to any geometry is gone
- fix the attribute slot a route took over: giving up that route hands the slot back to the route it took it from — the base route, or an attribute copied from a `BufferGeometry` passed to the `InstancedVOBufferGeometry` constructor
- fix the pool an attribute name resolves to in `InstancedVOBufferGeometry#update()`: it is the pool that feeds the attribute currently sitting in that slot. The base and the instanced route may therefore declare the same attribute name
- fix `TexturedSprites#createSprite()` and `TexturedSprites#freeSprite()` losing their bind to the sprite pool when called as `sprites.createSprite()` and `sprites.freeSprite(sprite)`; both run on the sprite pool of the mesh they are called on
- fix `AnimatedSpritesMaterial` crashing when constructed with, or assigned, an `animsMap` texture whose image has not loaded yet; it falls back to the neutral texture coordinates until an `AnimatedSpritesMaterial#touchAnimsMap()` call picks up the loaded image
- fix a generated setter to accept a typed array like it accepts a plain array: `b.setPos(a.getPos())` writes the values `a` carries
- fix a generated setter and `VertexObjectBuffer#copyAttributes()`: when the caller passes fewer values than `vertexCount * size`, unwritten components keep their previous value; single- and multi-component attributes behave the same way
- fix `OrthographicProjection#updateViewRect()` for a projection built without specs: `viewSpecs` holds an empty object from construction on, the shape `ParallaxProjection` starts from as well
- fix `InstancedVertexObjectGeometry`: a base capacity of `0` passed to the constructor reaches the base pool instead of becoming `1` — the same value `InstancedVOBufferGeometry` takes at that place
- fix `Display#canvas` after `dispose()`: it answers with `Display#canvas is not available: this display has been disposed` instead of a `TypeError` about a property of `undefined`
- fix `Display#nextFrame()`: a promise still pending when `dispose()` runs is rejected, instead of waiting for a frame that is never rendered again
- fix `TextureStore#get()`, `#whenReady()` and `#whenResource()`: a promise still pending when `dispose()` runs is rejected with an error naming the class and the state, instead of waiting for an event that never comes again. A call on a store that is already disposed is rejected right away
- fix `TextureStore#get()` for a value that is already there when it is called: it resolves with that value, instead of leaving the promise pending for good and reporting a `ReferenceError` through `console.warn`
- fix the moment a `TextureResource` releases a texture it replaces: the successor is published on the `texture` signal first, and only then does the predecessor fall. No subscriber of the `texture` event, and no read of `TextureResource#texture`, ever reaches a texture that is already disposed
- fix the clean-up chain of `TextureResource#load()`: every effect it registers is attached to the resource and torn down with it, so `load()` adds no listener of its own to the resource
- fix the `TileBox` pool of `CameraBasedVisibility`: every recomputation that finds the map plane leaves it holding the tiles that run visited and no others, and a frame in which the camera looks past the plane leaves it as it stands. A camera travelling far no longer leaves a `Box3`, a `Vector3` and a `Map2DTileCoords` behind per tile it has passed, and a tile that stays visible keeps its pooled objects as before
- fix the gpu buffer of an attribute that a second route pushed out of an attribute slot of an `InstancedVOBufferGeometry`: it stayed with the renderer with nothing left to reach it. three.js frees one attribute per name through the dispose event of the geometry — the one sitting in the slot at that moment — so the second route is refused instead
- fix the listener `FixedFrameLoop` leaves on its `Display`: the loop takes its own `OnDisplayDispose` subscription off again, so a display that outlives a series of short-lived loops no longer collects one closure over a spent loop per loop
- fix `Stylesheets.installRule()`: a name carries exactly one rule in the global stylesheet, and a call with a different `css` rewrites that rule instead of appending another one. The sheet no longer grows by a rule per `Display`, per created container, per fullscreen toggle and per value written to `PanControl2D#cursorPanStyle`
- fix a `Display` that is disposed before its renderer is ready: it does not put itself into its frame loop once the renderer initialization resolves, so the loop is left with no subscriber to carry
- fix the point helpers `CameraBasedVisibilityHelpers` draws: each one frees the box geometry and the material it is built from as the helpers are taken down or rebuilt, so a scene with the helpers switched on no longer collects a geometry and a material per point helper and per update
- fix `Map2DTileRenderer#dispose()`: every tile the renderer holds goes back to the factory through `destroyTile()`, so a `TileSpritesFactory` handed on to a second renderer gets the sprite pool slots of the first one back instead of finding them taken
- fix `PanControl2D#dispose()`: the cursor class comes off the `cursorStylesTarget` element the caller handed in, and the pan collected from a drag that was still running is dropped instead of being delivered by the next `update()`. A control that was hiding the cursor emits one last `restoreCursor` event on the way out, while its subscribers can still hear it. A write to `cursorPanStyle` on a disposed control does nothing rather than rewriting the cursor rule every control of the module shares
- fix the helper nodes `CameraBasedVisibilityHelpers` and `RectangularVisibilityAreaHelpers` build before a scene has been handed to them: switching the helpers on, or updating them, builds nothing while there is no scene to put the nodes into, so a set of `Box3Helper`s, `PlaneHelper`s and point helpers that no scene shows and nothing releases again is never created. The first `update()` after `add(scene)` puts the whole set in
- fix the moment `Canvas2DStage` releases the texture it replaces: the successor sits on the sprite material before the predecessor falls, so neither the material nor a read of `Canvas2DStage#texture` ever reaches a texture that is already disposed
- fix `Display#dispose()`: a container the display created inside a host element comes out of the DOM with the canvas in it, so a host that carries one display after another collects no dead canvas per cycle. A canvas or a renderer handed to the constructor keeps its place — it belongs to the caller
- fix the `Display` constructor for a first argument that is neither an HTML element nor a `WebGPURenderer`: it throws a `TypeError` naming what it takes, the same one a `WebGLRenderer` gets, instead of failing inside the renderer initialization with a message about a property of `undefined`
- fix a renderer that fails to initialize: the display emits its `error` event with the reason instead of leaving an unhandled rejection behind. `Display#start()` still rejects with the same error
- fix the fps `FrameLoop` measures after a pause: the first sample of the new measurement window is reported on its own, without the samples from before the pause averaged into it
- fix the coordinates `PanControl2D` measures a drag with: they are taken against `coordsTarget`, which stays the same element throughout the drag. Measuring against the element under the pointer moves the reference rectangle mid-drag as the pointer crosses other elements, and a shadow root retargets it onto the host on top of that
- fix `PanControl2D#pointerDisabled`: switching the pointer off drops the pan collected up to that moment instead of holding it back and delivering it in one jump when the pointer is switched on again
- fix the `update` event of `PanControl2D`: it goes out whenever `update()` moved the `panView`, including a control with both input sources switched off whose `speed…` fields were set by hand
- fix `RepeatingTilesProvider#getTileIdAt()` on a pattern without cells — the default pattern among them: it answers with `0`, the value `getTileIdsWithin()` fills such a pattern with, instead of computing an index through a modulo by zero and returning an `undefined` under a signature that promises a `number`
- fix `DataIdsChunk2D#readDataIdAt()` and `#readDataIdAtLocal()` for a coordinate outside the chunk: both hold it against the width and the height of the chunk and answer with `undefined`. An `x` past either edge folded into the neighbouring row and answered with a foreign id that looked valid

### Migration Guide

#### `TileSpritesFactory#freeTileSprite()` is gone

**Before**

```ts
factory.freeTileSprite(sprite);
```

**After**

```ts
factory.destroyTile(sprite);
```

#### A frame name in a `TextureAtlas` is taken only once

**Before**

```ts
atlas.add('hero', coordsA);
atlas.add('hero', coordsB); // the name moves to the second frame, the first one is orphaned
```

**After**

```ts
if (atlas.frameId('hero') == null) {
  atlas.add('hero', coordsB);
}
```

#### The frames of an atlas animation run in numeric order

**Before**

```ts
// the frames arrive as a lexicographic sort leaves them: walk.1, walk.10, walk.2
animations.add('walk', {frameRate: 10}, atlas, 'walk.');
```

**After**

```ts
// a number inside a name counts as a number: walk.1, walk.2, walk.10
animations.add('walk', {frameRate: 10}, atlas, 'walk.');
```

An atlas whose frame names were chosen to make a lexicographic sort come out right — padded to
`walk.01`, or numbered so that no sequence ever passes 9 — can drop that compensation: padded names
order the same way, and the unpadded ones now do too. Nothing throws over this: an animation built
around the other order simply plays in a different one.

#### `FrameBasedAnimations#animId()` throws on a name it does not know

**Before**

```ts
const id = animations.animId(nameFromUserData); // TypeError on undefined
```

**After**

```ts
const id = animations.hasAnimation(nameFromUserData) ? animations.animId(nameFromUserData) : fallbackId;
```

#### The `meta` of a loaded atlas names the image that was loaded

**Before**

```ts
const {meta} = await loader.loadAsync('atlas.json', undefined, {overrideImageUrl: 'sprites.png'});
meta.image; // the url the json names
```

**After**

```ts
const {meta} = await loader.loadAsync('atlas.json', undefined, {overrideImageUrl: 'sprites.png'});
meta.image; // 'sprites.png' — the image behind the texture
```

A caller that needs the url out of the json reads it from the json; what the atlas data reports is
the image its texture came from.

#### The derived values of `TextureResource` are read-only

`imageCoords`, `atlas`, `tileSet`, `texture` and `frameBasedAnimations` have no setters any
more; the effects of `load()` produce them. A texture built elsewhere is handed to a resource
through the `TextureFactory` that builds it.

**Before**

```ts
resource.texture = myTexture; // overwritten by the next effect run, and never released
```

**After**

```ts
resource.textureFactory = myFactory; // the resource builds — and owns — its texture
```

#### A setter that does not fit the kind of a resource throws

**Before**

```ts
const resource = TextureResource.fromImage('hero', 'hero.png');
resource.tileSetOptions = {tileWidth: 16}; // swallowed, getter keeps answering undefined
```

**After**

```ts
const resource = TextureResource.fromTileSet('hero', 'hero.png', {tileWidth: 16});
resource.tileSetOptions = {tileWidth: 32}; // a tileset resource takes it
```

#### An atlas resource takes its image from its json

`imageUrl` is what an atlas resource *reports*, not what it is told. `overrideImageUrl` is
the input that moves such a resource to another image, and it moves the atlas along with the
texture.

**Before**

```ts
const resource = await store.whenResource('hero');
resource.imageUrl = 'hero@2x.png'; // texture follows, atlas keeps describing the old file
```

**After**

```ts
const resource = await store.whenResource('hero');
resource.overrideImageUrl = 'hero@2x.png'; // atlas and texture move together
```

#### `TextureStore#load()` returns a promise

The store is no longer the return value, so a call that went on chaining needs the store
itself.

**Before**

```ts
store.load(url).parse(moreData);
```

**After**

```ts
store.load(url);
store.parse(moreData);
```

Both lines stand for themselves: the fetch is on its way, and `moreData` is parsed right
away. Put an `await` in front of the load where the second parse should wait for the first.

#### `TileBox#primary` marks every tile the view frustum meets the plane in

`CameraBasedVisibility` tests nine rays through the view frustum against the map plane, and `primary` marks the tiles they met — up to nine places on the map, rather than the one under the center of the view.

**Before**

```ts
// the tile under the center of the view, and its neighbours
const underTheCamera = visibility.visibles.filter((tile) => tile.primary);
```

**After**

```ts
// the tile under the center of the view: the first probe ray is the center one
const [centerPoint] = visibility.pointsOnPlane;
```

Whoever wants the tiles the view frustum meets the plane in — all of them — keeps reading `primary`.

#### A disposed display refuses to be used

`Display#canvas`, `#start()` and `#getEventProps()` throw once `dispose()` has run, and
`#nextFrame()` is rejected — both a call made afterwards and a promise that was still open when
`dispose()` ran. `#resize()`, `#renderFrame()`, `#stop()`, a write to `#pause` and a further
`#dispose()` do nothing. `#pause` is the one of them with a getter, and it keeps reading the state
the display was left in: a display disposed while it was running answers `true` however it is
written. Use `Display#isDisposed` where a display may already be gone.

The case that slips through without a compile error is an awaited `nextFrame()` next to a
`dispose()` from another path: that `await` needs a `catch` around it.

**Before**

```ts
async function renderLoop(display: Display) {
  while (true) {
    const {now} = await display.nextFrame(); // hangs once someone disposes the display
    drawSomething(now);
  }
}
```

**After**

```ts
async function renderLoop(display: Display) {
  try {
    while (true) {
      const {now} = await display.nextFrame();
      drawSomething(now);
    }
  } catch {
    // the display is gone — leave the loop
  }
}
```

#### `Display#isWebGPUBackend` and `#isWebGLBackend` answer only while the display is alive

Both getters throw once `dispose()` has run: `false` cannot tell "the backend was never WebGPU"
apart from "the display is gone". Ask `Display#isDisposed` first wherever a display may already
have been released.

**Before**

```ts
function backendName(display: Display) {
  return display.isWebGPUBackend ? 'webgpu' : 'webgl'; // says "webgl" for a disposed display
}
```

**After**

```ts
function backendName(display: Display) {
  if (display.isDisposed) return 'gone';
  return display.isWebGPUBackend ? 'webgpu' : 'webgl';
}
```

#### A disposed texture store rejects what its callers are still awaiting

`TextureStore#get()`, `#whenReady()` and `#whenResource()` reject once `dispose()` has run —
both a call made afterwards and a promise that was still open when `dispose()` ran. The case
that slips through without a compile error is a `get()` whose result nobody guards.

**Before**

```ts
const store = new TextureStore(renderer);
store.parse(data);

store.get('hero', 'texture').then((texture) => {
  material.map = texture; // never runs once the store is gone, and nothing says why
});

store.dispose();
```

**After**

```ts
const store = new TextureStore(renderer);
store.parse(data);

store.get('hero', 'texture')
  .then((texture) => {
    material.map = texture;
  })
  .catch(() => {
    // the store is gone — nothing left to wait for
  });

store.dispose();
```

#### `TextureStore#get()` gives up on an id the data does not name

An id that is still missing after the first `parse()` is rejected instead of waiting for a
second one. Code that relied on the wait has to subscribe rather than ask.

**Before**

```ts
const texture = store.get('hero', 'texture'); // waits for whichever parse() brings 'hero'

store.parse(baseData);
store.parse(extraData); // 'hero' arrives here
```

**After**

```ts
// a subscription still waits for a later parse()
const unsubscribe = store.on('hero', 'texture', (texture) => {
  material.map = texture;
});

store.parse(baseData);
store.parse(extraData);
```

#### A disposed texture store and its resources go quiet

Once `TextureStore#dispose()` has run, `renderer` and `textureFactory` answer `undefined`, and
`parse()`, `load()`, `on()`, `onResource()` and a write to `renderer` do nothing. The same holds
for the resources it handed out: every getter of a disposed `TextureResource` answers `undefined`
and its `load()` registers nothing, while `id` and `type` still say which resource it was.

Nothing here shows up as a compile error — the getters are typed `T | undefined` either way. Read
what you need while the store is alive, and keep the value rather than the store.

**Before**

```ts
const resource = await store.whenResource('hero');

store.dispose();

resource.load(); // registers effects that no dispose() can take down again
const tileSet = resource.tileSet; // a tile set out of a resource that is already gone
```

**After**

```ts
const resource = await store.whenResource('hero');
resource.load();
const tileSet = resource.tileSet;

store.dispose(); // the value you took stays; the resource says nothing more
```

#### An attribute slot belongs to one route

`InstancedVOBufferGeometry#attachInstancedPool()` throws when an attribute of the pool would take
an attribute slot that the geometry has already had an attribute in — including a slot that a
detached route has left empty. Give each pool attribute names of its own, or build a geometry per
pool. The same pool under a second name, and the `instancedPool` attached as an extra pool, are
refused for the same reason.

**Before**

```ts
const geometry = new InstancedVertexObjectGeometry(instancedDesc, 1000, quadDesc, 1);

// both declare an attribute named 'offset'
geometry.attachInstancedPool('a', offsetDesc);
geometry.attachInstancedPool('b', otherOffsetDesc); // the attribute of 'a' is stuck on the gpu
```

**After**

```ts
const geometry = new InstancedVertexObjectGeometry(instancedDesc, 1000, quadDesc, 1);

geometry.attachInstancedPool('a', offsetDesc);
geometry.attachInstancedPool('b', velocityDesc); // 'velocity' is a slot of its own
```

Replacing a route under a name it already holds still works, as long as the pool taking over
brings attribute names the geometry has not had yet:

```ts
geometry.attachInstancedPool('a', offsetDesc);
geometry.attachInstancedPool('a', velocityDesc); // releases the route 'a' had, takes a free slot
```

#### Geometry, material and texture handed in stay the caller's to dispose

`TexturedSprites#dispose()`, `AnimatedSprites#dispose()` and `AnimatedSpritesMaterial#dispose()`
release only what the instance built itself. Whatever was handed to a constructor or a setter is
now disposed by whoever created it. The case that slips through without a compile error is
`new AnimatedSprites(geometry, material)`: that mesh built neither, so it releases nothing.

**Before**

```ts
const sprites = new AnimatedSprites(geometry, material);
material.animsMap = animsMap;

sprites.dispose();
// geometry, material and animsMap were all released along with the mesh
```

**After**

```ts
const sprites = new AnimatedSprites(geometry, material);
material.animsMap = animsMap;

sprites.dispose();

geometry.dispose(); // built by the caller, released by the caller
material.dispose();
animsMap.dispose();
```

A mesh that builds its own geometry and material still releases them, so
`new TexturedSprites(1000).dispose()` needs no change.

#### The `three` peer dependency range

**Before**

```json
{
  "dependencies": {
    "three": "~0.183.1"
  }
}
```

**After**

```json
{
  "dependencies": {
    "three": "~0.185.1"
  }
}
```

Callers who write their own TSL materials need one change that the range alone does not show. `vec3()` and its siblings dropped the overload that took an `AttributeNode<unknown>`, which is what a bare `attribute('name')` returns:

```ts
// before
const size = vec3(attribute('quadSize'));

// after
const size = vec3(attribute<'vec2'>('quadSize'));
```

Nothing changes at runtime — the shader attribute was already read at that type. The type argument only says so where the compiler can see it.

#### `@spearwolf/eventize` and `@spearwolf/signalize` peer dependency ranges

Both peer dependencies moved to a new major. Consumers have to bump them together:

**Before**

```json
{
  "dependencies": {
    "@spearwolf/eventize": "^5.0.0",
    "@spearwolf/signalize": "^0.30.0"
  }
}
```

**After**

```json
{
  "dependencies": {
    "@spearwolf/eventize": "^6.2.0",
    "@spearwolf/signalize": "^1.0.0"
  }
}
```

Two things are worth checking after the bump, because neither is visible to the type checker:

- **Deduplicate `@spearwolf/eventize`.** Its marker is keyed by `Symbol.for('eventize')` and therefore realm-wide, so a `^5` and a `^6` resolved side by side share one slot per object. Where v5 dispatched across the boundary for a while and then failed obscurely, v6 versions the marker payload and throws a `TypeError` naming both protocols. Check with `npm ls @spearwolf/eventize` and pin `^6` via `overrides` / `resolutions` if a transitive dependent still asks for the old range. The same applies to `@spearwolf/signalize`, whose internal `Symbol.for` keys moved into a `@spearwolf/signalize/` namespace: a pre-`1.0` and a `1.0` copy share nothing at all.
- **Bulk `off()` now clears retained state.** `off(ε)`, `off(ε, '*')` and any name array containing `'*'` or a nullish element wipe the retained values and retain policies along with the listeners. Targeted forms — `off(ε, eventName)`, `off(ε, [names])` — are unchanged.

Code that only consumes this library's public API needs no further changes. Code that calls `eventize` or `signalize` directly should read the upstream migration notes; the breaking changes that bite without a compile error are the `off()` semantics above and, on the signalize side, `batch()` / `beQuiet()` / `hibernate()` refusing an `async` callback.

#### `VertexObjectPool#onDestroyVO` is gone

Per-object cleanup belongs at the call site that releases the vertex object.

**Before**

```ts
pool.onDestroyVO = (vo) => {
  scene.remove(meshOf(vo));
};

pool.freeVO(vo);
pool.dispose();
```

**After**

```ts
scene.remove(meshOf(vo));
pool.freeVO(vo);

for (const vo of myLiveVOs) {
  scene.remove(meshOf(vo));
}
pool.dispose();
```

Note that `dispose()` does not walk the pool on your behalf: keep your own list of the vertex objects whose resources you have to release.

#### `VertexObjectPool#createVO()` can return `undefined`

Under `strictNullChecks` the honest return type turns an unguarded call into a compile error.

**Before**

```ts
const vo = pool.createVO();
vo.setFoo(1, 2);
```

**After**

```ts
const vo = pool.createVO();
if (vo == null) return; // the pool is full
vo.setFoo(1, 2);
```

Where the capacity is known to suffice, `pool.createVO()!` is the shorter way out.

#### `TexturedSprites#createSprite()` can return `undefined`

`createSprite` and `freeSprite` are methods now, called as `sprites.createSprite()` and
`sprites.freeSprite(sprite)`. Under `strictNullChecks`, the honest return type of `createSprite()`
turns an unguarded call into a compile error.

**Before**

```ts
const sprite: TexturedSprite = sprites.createSprite();
sprite.setPosition(1, 2, 3);
```

**After**

```ts
const sprite = sprites.createSprite();
if (sprite == null) return; // the sprite pool is full
sprite.setPosition(1, 2, 3);
```

#### A geometry releases only the pools it built itself

`VOBufferGeometry#dispose()`, `InstancedVOBufferGeometry#dispose()` and the `autoDispose` default of
`attachInstancedPool()` all follow one rule now: a pool the geometry created belongs to the geometry
and is disposed with it, a pool handed in belongs to the caller and is left alone. Three call
patterns change because of it.

**Before**

```ts
const shared = new VertexObjectPool(descriptor, 1000);

const geometry = new InstancedVertexObjectGeometry(shared, 1000, baseDescriptor, 1);
geometry.attachInstancedPool('extra', otherSharedPool);

geometry.dispose();
// shared.usedCount === 0     — the geometry cleared a pool it did not own
// otherSharedPool.usedCount === 0
// geometry.basePool was only cleared, its typed arrays stayed referenced
```

**After**

```ts
const shared = new VertexObjectPool(descriptor, 1000);

const geometry = new InstancedVertexObjectGeometry(shared, 1000, baseDescriptor, 1);
geometry.attachInstancedPool('extra', otherSharedPool);

geometry.dispose();
// shared and otherSharedPool are untouched — both were handed in
// basePool, built from baseDescriptor, is disposed with the geometry

shared.clear(); // opt back into the old behaviour, per pool
```

To have a pool that was handed in released with the geometry, say so:

```ts
geometry.attachInstancedPool('extra', otherSharedPool, {autoDispose: true});
```

`detachInstancedPool()` follows the same rule and therefore also changed: it releases a pool that
belongs to the geometry instead of only unhooking it. The pool it returns is dead in that case.

```ts
const pool = geometry.attachInstancedPool('extra', descriptor); // built here, so owned here
geometry.detachInstancedPool('extra');
// pool.isDisposed === true

const mine = geometry.attachInstancedPool('extra', new VertexObjectPool(descriptor, 100));
geometry.detachInstancedPool('extra');
// mine.isDisposed === false — it was handed in
```

Note that `dispose()` is more than `clear()`: it drops the typed arrays of the pool, and any
vertex object still held by the caller is unlinked from its buffer. Keep pools you want to reuse out
of a geometry's constructor, or hand them in as pools rather than as descriptors.

Sharing a pool between geometries is the caller's job for the same reason: the geometry that built a
pool releases it on `dispose()`, whoever else reads it by then. Passing on a pool a geometry built
for itself is therefore the one pattern to drop.

**Don't**

```ts
const one = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const two = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);

const shared = one.attachInstancedPool('extra', descriptor); // one built it, so one owns it
two.attachInstancedPool('borrowed', shared);

one.dispose();
// shared.isDisposed === true, and its typed arrays are gone
// two keeps the attributes it built on them: they read nothing, and two.update() leaves them be
```

**Do**

```ts
const shared = new VertexObjectPool(descriptor, 1000); // built by the caller, owned by the caller

const one = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const two = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);

one.attachInstancedPool('extra', shared);
two.attachInstancedPool('borrowed', shared);

one.dispose();  // shared is untouched — neither geometry built it
shared.dispose(); // when both geometries are gone
```

#### `float16` attributes are half floats

A `float16` attribute's buffer is a `Float16Array`. Values written through the generated accessors
round to half-float precision instead of being truncated to an integer.

**Before**

```ts
vo.v = 0.1;
vo.v; // 0
```

**After**

```ts
vo.v = 0.1;
vo.v; // 0.0999755859375
```

Two things follow from the switch:

- The runtime needs `Float16Array`. It shipped in Node 24 and has been available in every major
  browser engine since 2025; a runtime without it throws on the first `float16` attribute. The
  published package carries no `engines` field, so npm does not warn — this note is the only
  place the requirement is stated.
- A consumer that names the `TypedArray` type from this package directly needs a `tsconfig.json`
  `lib` that includes `ESNext.Float16` (TypeScript 5.9.3: the declaration lives in
  `lib.esnext.float16.d.ts`, in no year-numbered `lib`).

#### `InstancedVOBufferGeometry#attachInstancedPool()` returns a typed pool

The return type carries the vertex object type of the attached pool instead of `any`.

**Before**

```ts
const pool = geometry.attachInstancedPool('extra', descriptor);
pool.createVO().setFoo(1); // any, no compile-time check
```

**After**

```ts
const pool = geometry.attachInstancedPool<MyExtraVO>('extra', descriptor);
pool.createVO()?.setFoo(1); // typed as MyExtraVO
```

Without a type argument, `pool` is typed `VertexObjectPool<unknown>`.

#### A descriptor handed to `attachInstancedPool()` gets the instanced pool's capacity

`attachInstancedPool()` wraps a descriptor or description in a pool sized like the geometry's
`instancedPool`, so the extra pool holds one vertex object per instance.

**Before**

```ts
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const extra = geometry.attachInstancedPool('extra', descriptor);
extra.capacity; // 1
```

**After**

```ts
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const extra = geometry.attachInstancedPool('extra', descriptor);
extra.capacity; // 1000
```

Hand in a pool rather than a descriptor to pick the capacity yourself:

```ts
geometry.attachInstancedPool('extra', new VertexObjectPool(descriptor, 100));
```

A pool handed in that way belongs to the caller, and the geometry leaves it alone on `dispose()`.

#### Projection fields name the values their constructors write

`OrthographicProjection#projectionPlane`, `ParallaxProjection#projectionPlane` and the
`IProjection#projectionPlane` getter are typed `ProjectionPlane | undefined`, and
`OrthographicProjection#viewSpecs` is typed `Partial<OrthographicProjectionSpecs>`: both fields
hold exactly what a projection was built with, and a projection built without a plane or without
specs is not exempt. Under `strictNullChecks`, code that reads either field without a guard turns
into a compile error. A projection built with both a plane and specs — the normal case — needs no
change.

**Before**

```ts
const projection = new OrthographicProjection();
projection.projectionPlane.getPointByDistance(100);

const specs: OrthographicProjectionSpecs = projection.viewSpecs;
```

**After**

```ts
const projection = new OrthographicProjection();
projection.projectionPlane?.getPointByDistance(100);

const specs: Partial<OrthographicProjectionSpecs> = projection.viewSpecs;
```

#### `TextureAtlas#randomFrame()` and its siblings can answer `undefined`

An atlas without frames has none to draw, and one without named frames has no name to hand back.
Under `strictNullChecks` an unguarded call is a compile error.

**Before**

```ts
const frame: TextureAtlasFrame = atlas.randomFrame();
const names: TextureAtlasFrameName[] = atlas.randomFrameNames(4);
```

**After**

```ts
const frame = atlas.randomFrame();
if (frame == null) return; // the atlas carries no frames

const names = atlas.randomFrameNames(4).filter((name) => name != null);
```

For an atlas that is known to be loaded, `atlas.randomFrame()!` is the shorter way out.

#### `getDescriptorOf()` and `VO[voBuffer]` follow the lifetime of the vertex object

A vertex object that `freeVO()` or `dispose()` has released holds no buffer, so it has no
descriptor either. Both now say so.

**Before**

```ts
const {vertexCount} = getDescriptorOf(vo);
```

**After**

```ts
const descriptor = getDescriptorOf(vo);
if (descriptor == null) return; // the pool has released this vertex object
const {vertexCount} = descriptor;
```

Where the vertex object is known to be live — inside a getter it defines, for instance —
`getDescriptorOf(vo)!` says that in one character.

#### `VertexObjects#geometry` and `#material` can be `undefined`

`VertexObjects` takes both as optional constructor arguments, and the sprite meshes built on it
give both slots up in `dispose()`. Reading through either needs a guard.

**Before**

```ts
sprites.geometry.instancedPool.createVO();
sprites.material.colorMap = texture;
```

**After**

```ts
sprites.geometry?.instancedPool.createVO();
if (sprites.material != null) {
  sprites.material.colorMap = texture;
}
```

#### `TexturedSprites#spritePool` and `#texture` can be `undefined`

`TexturedSprites#dispose()` gives up the geometry and the material and leaves the mesh
holding neither. `spritePool` and `texture` name that: both are typed `| undefined`,
`createSprite()` answers `undefined`, and `freeSprite()` and a write to `texture` do nothing
once the sprites are disposed. Under `strictNullChecks`, code that reads either field
without a guard turns into a compile error. Sprites that have not been disposed — the normal
case — need no change.

**Before**

```ts
const sprites = new TexturedSprites(1000);
const pool: TexturedSpritePool = sprites.spritePool;
```

**After**

```ts
const sprites = new TexturedSprites(1000);
const pool = sprites.spritePool;
if (pool == null) return; // the sprites were disposed
```

#### `Map2D#visibilitor` can be `undefined`

A `Map2D` carries a visibilitor only once one has been assigned. The getter names that;
the setter is unchanged and still takes an `IMap2DVisibilitor`. Under `strictNullChecks`,
reading the getter into a non-optional binding turns into a compile error.

**Before**

```ts
const visibilitor: IMap2DVisibilitor = map2d.visibilitor;
```

**After**

```ts
const visibilitor = map2d.visibilitor;
if (visibilitor == null) return; // none assigned yet
```

#### `Map2DTileRenderer#tileFactory` is `null` after `dispose()`

`dispose()` drops the factory, and the field names that with `| null`. The six update-cycle
methods do nothing while it is `null`, so a renderer that is passed around after it was disposed
raises nothing and changes nothing — a `try`/`catch` placed around such a call has nothing left to
catch and can go. A renderer in use needs no guard; only code that reads `tileFactory` itself
does.

**Before**

```ts
const factory: IMapTileFactory = renderer.tileFactory;
```

**After**

```ts
const factory = renderer.tileFactory;
if (factory == null) return; // the renderer has been disposed
```

#### A disposed `Map2D` releases none of its tile renderers

`Map2D#dispose()` takes every tile renderer off the map and off the scene graph, and releases
none of them. A renderer is disposed by whoever created it. The case that slips through without a
compile error is a caller that handed a renderer in and relied on the map to take it down.

**Before**

```ts
const map2d = new Map2D();
map2d.addTileRenderer(new Map2DTileRenderer(tileSpritesFactory));

map2d.dispose(); // the renderer went down with the map
```

**After**

```ts
const map2d = new Map2D();
const renderer = new Map2DTileRenderer(tileSpritesFactory);
map2d.addTileRenderer(renderer);

map2d.dispose();
renderer.dispose(); // built by the caller, released by the caller
```

#### `CameraBasedVisibility#pointOnPlane` can be `null`

The field holds `null` while the camera looks past the map plane, and `undefined` before the
first frame has computed anything. Both states are reachable at runtime, and the type names
them. A `== null` check covers both.

**Before**

```ts
const point: Vector3 = visibility.pointOnPlane;
```

**After**

```ts
const point = visibility.pointOnPlane;
if (point == null) return; // the camera does not look at the plane
```

#### `DataIdsChunk2D#readDataIdAt()` can answer `undefined`

Coordinates outside the chunk read past its data array. The return type names that; use
`containsDataAt()` to ask first, or take the `undefined`.

**Before**

```ts
const id: number = chunk.readDataIdAt(x, y);
```

**After**

```ts
const id = chunk.readDataIdAt(x, y);
if (id === undefined) return; // (x, y) is outside this chunk
```

#### `VertexObjectBuffer` buffers can hold no typed array

`VOBufferPool#dispose()` drops the typed arrays so the underlying `ArrayBuffer`s can be
reclaimed. A buffer reached through a living pool always holds its array; a reference kept
across the `dispose()` does not.

**Before**

```ts
const buf = pool.buffer.buffers.get('static_float32');
const values = Array.from(buf.typedArray);
```

**After**

```ts
const buf = pool.buffer.buffers.get('static_float32');
if (buf?.typedArray === undefined) return; // the pool has been disposed
const values = Array.from(buf.typedArray);
```

#### `VertexObjectBuffer#toAttributeArrays()` can answer without an array

The method returns one entry per requested name. A name the descriptor does not know gets
an entry whose value is `undefined`, and the return type says so.

**Before**

```ts
const arrays = vob.toAttributeArrays(['foo', 'bar']);
const foo: TypedArray = arrays['foo'];
```

**After**

```ts
const arrays = vob.toAttributeArrays(['foo', 'bar']);
const foo = arrays['foo'];
if (foo === undefined) return; // 'foo' is not an attribute of this descriptor
```

#### `FrameLoop#start()` can answer `undefined`

The method hands back a function that unsubscribes the `target` again. There is nothing to
hand back for a missing `target` or for one that is already running on the loop.

**Before**

```ts
const unsubscribe = frameLoop.start(target);
unsubscribe();
```

**After**

```ts
const unsubscribe = frameLoop.start(target);
unsubscribe?.(); // or use frameLoop.stop(target)
```

#### A disposed `StageRenderer` leaves its pipeline alone

`StageRenderer#dispose()` releases the render targets the renderer built for itself. A
`pipeline` was assigned from outside and is disposed by whoever built it. The case that slips
through without a compile error is a renderer that was the only thing holding the pipeline.

**Before**

```ts
const sr = new StageRenderer(display);
sr.pipeline = new RootRenderPipeline(display.renderer!);

sr.dispose(); // the pipeline went with it
```

**After**

```ts
const sr = new StageRenderer(display);
const pipeline = new RootRenderPipeline(display.renderer!);
sr.pipeline = pipeline;

sr.dispose();

pipeline.dispose(); // built by the caller, released by the caller
```

A renderer without a pipeline needs no change.

#### A disposed child leaves its holder before it goes

`StageRenderer#asPassNode()` throws once `dispose()` has run: the node it returns promises a
pass-target, and a disposed renderer builds none. The direct call is the visible half. The half
that slips through without a compile error is a **live** parent with `buildOutputNode` or a
`RootRenderPipeline`: it asks every nested child for its pass node once per frame, so a child
disposed while it is still in the parent's stage list turns every frame of that parent into a
throw.

A child that came in through `child.parent = parent` takes itself off the list as it is
disposed. A child added with `parent.add(child)` never learned who holds it — that one has to be
removed by hand, and `parent.remove(child)` now clears the child's `parent` as well.

**Before**

```ts
const parent = new StageRenderer(display);
parent.pipeline = pipeline;
parent.buildOutputNode = (passes) => passes[0]!;

const child = new StageRenderer();
parent.add(child);

child.dispose(); // the child is still a stage of the parent
```

**After**

```ts
const parent = new StageRenderer(display);
parent.pipeline = pipeline;
parent.buildOutputNode = (passes) => passes[0]!;

const child = new StageRenderer();
parent.add(child);

parent.remove(child); // added with add(), so it has to be taken off by hand
child.dispose();
```

A parent without `buildOutputNode` and without a `RootRenderPipeline` asks for no pass node and
needs no change — though a child left in its stage list is dead weight either way.

#### A geometry is built while its pool is alive

The `VOBufferGeometry` and `InstancedVOBufferGeometry` constructors and
`InstancedVOBufferGeometry#attachInstancedPool()` throw for a pool that has been disposed. Such a
geometry had no attributes and drew nothing, and nothing about it said so — now the error names the
call and the state at the place the geometry is built.

**Before**

```ts
const pool = new VertexObjectPool(descriptor, 1000);
pool.dispose();

const geometry = new VertexObjectGeometry(pool, 1000); // no attributes, draws nothing
scene.add(new THREE.Mesh(geometry, material));
```

**After**

```ts
const pool = new VertexObjectPool(descriptor, 1000);

const geometry = new VertexObjectGeometry(pool, 1000);
scene.add(new THREE.Mesh(geometry, material));

// the pool goes when nothing reads it any more
```

#### The event keys of `FrameLoop` carry the library namespace

The symbols are exported; take them from the module instead of building them from their name.

**Before**

```ts
const OnFrame = Symbol.for('onFrame');

display.frameLoop.start({
  [OnFrame]({now, deltaTime}) {
    // ...
  },
});
```

**After**

```ts
import {FrameLoop} from '@spearwolf/twopoint5d';

display.frameLoop.start({
  [FrameLoop.OnFrame]({now, deltaTime}) {
    // ...
  },
});
```

#### A tile id pattern is rectangular

**Before**

```ts
// the width came from the first row, the shorter row below answered with undefined
const provider = new RepeatingTilesProvider([
  [1, 2, 3],
  [4, 5],
]);
```

**After**

```ts
// every row carries the length of the first one
const provider = new RepeatingTilesProvider([
  [1, 2, 3],
  [4, 5, 0],
]);
```

A pattern without a row — `[]` through the `tileIds` setter — is refused as well. The empty
pattern of a provider built without arguments is `[[]]`: one row, no column.

## [0.21.2] - 2026-06-19

- upgrade `@spearwolf/signalize` dependencies to latest versions

## [0.21.1] - 2026-05-13

- upgrade `@spearwolf/eventize` and `@spearwolf/signalize` dependencies to latest versions

## [0.21.0] - 2026-05-13

### Added

- add `TextureStore#whenResource(id)` — resolves once the resource is present (typically after `parse()`), rejects with a descriptive error after the first `OnReady` if the id is still missing. Replaces the previous "promise hangs forever on typo" failure mode of `get()` for missing ids
- add `options.signal` (`AbortSignal`) to `TextureStore#get(id, type, options?)` — allows callers to abort a pending `get()` (rejects with a `DOMException` named `AbortError`)
- add `TextureStore#clearUnused()` — disposes and removes every resource with `refCount === 0`; returns the number of resources cleared. Pairs with the existing refCount bookkeeping that subscriptions maintain via `store.on(id, type, ...)` / `store.get(...)`
- add `TextureStore#textureFactory` getter — exposes the single shared `TextureFactory` the store uses for all of its resources. Re-created automatically whenever `renderer` changes; the store now injects this factory into every managed resource so every `TextureStore` has exactly one factory per renderer (previously each resource spun up its own)
- add `TextureStoreEvents` constants — public string constants for the events emitted by `TextureStore` (`Ready`, `RendererChanged`, `Resource`, `Dispose`, `Error`). `Error` is new and carries `{source: 'fetch' | 'parse', url, error}`
- add `TextureResourceEvents` constants — public string constants for the events emitted by `TextureResource` (per-subtype events, plus `Dispose` and a new `Error` event carrying `{source: 'image' | 'atlas', url, error}`)
- add `TextureResourceSubtypes` constants — typed string constants for the five resource subtypes (`ImageCoords`, `Atlas`, `TileSet`, `Texture`, `FrameBasedAnimations`); fully interchangeable with the raw string literals (`'imageCoords'`, `'atlas'`, …) in `TextureStore#on(id, type, …)` and `TextureStore#get(id, type, …)` — both forms type-check identically. Pick whichever reads more clearly at the call site (the literals stay the recommended default in tests/demos for brevity; the constants are useful inside larger config objects or when grep-finding usage)
- add optional `frameBasedAnimations` argument to `TextureResource.fromAtlas(id, atlasUrl, overrideImageUrl?, textureClasses?, frameBasedAnimations?)` — parity with `fromTileSet`; atlas resources can now be constructed with their animation map up front. The `frameBasedAnimationsData` setter is now also honored for atlas resources (previously a silent no-op because the signal only existed on tile-set resources)

- add `FixedFrameLoop` — opt-in helper that wraps a `Display` and emits `OnTick` events at a fixed rate (default 60 fps) plus an `OnRender` event per render frame carrying an `alpha` interpolation factor in `[0, 1)`. Decouples simulation cadence from render cadence so per-frame JS-cost variance (physics, animation curves, IK) no longer produces visible micro-stutter even on high-refresh-rate displays. Spiral-of-death guard via `maxStepsPerFrame` (default 5). Auto-disposes when `Display` disposes
- add `Display#maxDeltaTime` getter/setter — proxy for the internal `Chronometer#maxDeltaTime`; default is `1 / 30` (~33ms) so individual frame outliers are capped instead of producing spikes. Set to `0` to disable
- add `Display#resizePollIntervalMs` — optional throttle (in milliseconds) for the per-frame DOM measurements inside `Display#resize()`. Default `0` keeps the legacy "measure every frame" behavior; on high-refresh-rate displays setting it to e.g. `1000 / 60` caps `getComputedStyle()` / `getBoundingClientRect()` calls and reclaims a significant slice of the frame budget
- add `Chronometer#reset(time?)` — return the chronometer to its initial state without allocating a new instance; `maxDeltaTime` is preserved
- add `Chronometer#maxDeltaTime` (also exposed as the second constructor argument) — optional upper bound for the per-`update()` delta; overflow is folded into `lostTime` so `time` stays continuous (covers rAF throttling in background tabs, long GC pauses, breakpoints). Default `0` means "disabled"
- add optional `time?` argument to `Chronometer#stop()` and `Chronometer#start()` — lets callers pin pause/resume to an explicit wall-clock so `lostTime` is tracked correctly even when no `update()` runs during the pause
- add `FixedFrameLoop.spec.ts` — 13 vitest cases covering tick cadence, accumulator drain, alpha monotonicity, multi-tick frames, spiral-of-death guard, prop forwarding, runtime `fps` updates, `reset()`, `dispose()` and `OnDisplayDispose` auto-cleanup
- add `FrameLoop.spec.ts` — vitest coverage for the first-frame `deltaTime`, `lastNow` emission, `measuredFps` warm-up, `maxFps` throttling (including grid-stability over many frames, jitter tolerance, long-pause snap-forward and `setFps()` reset), and `subscriptionCount` idempotency
- add `Chronometer.spec.ts` cases for: pause-without-update jump regression, hybrid pause (updates + idle wall-clock), `stop()`/`start()` idempotency, `maxDeltaTime` clamping, `reset()`
- add `IRenderable` interface (`renderTo(renderer: WebGPURenderer): void`) — implemented by `Stage2D` and `StageRenderer`
- add `IPassProvider` interface (`asPassNode(renderer): Node`) — TSL contribution of a stage; implemented by `Stage2D` (returns `pass(scene, camera)`) and `StageRenderer` (returns `texture(internalRT.texture)`)
- add `IStageRendererHost` interface (`onResize`, `onRenderFrame`) — the parent type a `StageRenderer` needs from a frame-loop host; `Display` satisfies it structurally
- add `ClearStage` — marker stage that emits `renderer.clear(...)` between siblings; depth-only by default, configurable via `{color, depth, stencil}` (use case: drop the depth buffer before drawing UI on top of the world)
- add `RootRenderPipeline` — `RenderPipeline` subclass with a built-in additive `buildOutputNode` (`p0.add(p1).add(p2)…`); assign as `StageRenderer.pipeline` to skip the `buildOutputNode` boilerplate for the common "compose every stage" case. User-set `buildOutputNode` still overrides the default
- add `StageRenderer#clear: boolean` flag — explicit opt-in for clearing the render target before drawing the stages (default `false`)
- add `StageRenderer#pipeline?: RenderPipeline` — optional `three.RenderPipeline` integration; without `buildOutputNode` (Mode C / §6.4) the stages render into an internal `RenderTarget` whose texture is sampled as `pipeline.outputNode`; with `buildOutputNode` (Mode D / §6.2) the user composes a TSL graph from per-stage pass nodes
- add `StageRenderer#outputRenderTarget?: RenderTarget` — redirect the renderer's final output into a `RenderTarget` instead of the canvas; useful for picking, screenshots or downstream passes; combines with `pipeline`
- add `StageRenderer#buildOutputNode?: (passes: Node[]) => Node` — TSL-composition hook used together with `pipeline`; called when the stage list changes; returns the node used as `pipeline.outputNode`
- add `StageRenderer#invalidateOutputNode()` — explicit "rebuild on next render" for the pipeline's `outputNode`
- add `StageRenderer#dispose()` — releases internal `RenderTarget`s and `this.pipeline`
- add `StageRenderer#asPassNode(renderer)` — returns a `texture()` node sampling this renderer's pass-target, for use inside a parent's `buildOutputNode`; the parent automatically pre-renders nested `StageRenderer` children into their pass-target before its own pipeline runs (§6.3)
- add `Stage2D#asPassNode(renderer)` — returns `pass(scene, camera)`; throws when camera is not ready (assign `projection` or call `resize()` first)
- add `OnAddToParent` event on `StageRenderer` (symmetric to `OnRemoveFromParent`)
- add `Stage2D#renderTo(renderer)` — renders `scene` with `camera`; no-op until both exist
- add fluent return (`this`) on `StageRenderer#add()`, `#remove()`, `#setClearColor()`, `#attach()`, `#detach()` — enables the three-line "Display + Stage2D + StageRenderer" idiom
- add JSDoc on `StageRenderer` covering the two frame-loop modes (auto via `parent`, manual via direct `updateFrame()` + `renderTo()`), the clear policy, and the `name` / `renderOrder` uniqueness requirement
- add `packages/twopoint5d/src/stage/README.md` cheat-sheet documenting roles, hello-world, manual vs. auto-driven mode, layering, `ClearStage`, nesting, clear policy table, custom stages, events, custom hosts and common pitfalls
- add `StageRenderer.spec.ts` (21 cases) covering clear policy, rendering order, fluent API, name-collision warning, host wiring, parent/child nesting and `OnAddToParent`/`OnRemoveFromParent` symmetry
- add `ClearStage.spec.ts` (5 cases) covering default flags, explicit options, naming, no-op lifecycle methods and runtime flag changes
- add Stage2D `renderTo()` unit tests and an assertion that the removed clear-properties are no longer exposed
- add browser test `stage-renderer.test.js` in `@spearwolf/twopoint5d-testing` covering Display-driven rendering, additive multi-stage rendering, nested renderers, and `detach()`-unhook
- add browser test `stage-pipeline.test.js` in `@spearwolf/twopoint5d-testing` covering Mode C internal-RT sampling, Mode D `buildOutputNode` invocation, and `dispose()` lifecycle
- add `RootRenderPipeline.spec.ts` (9 cases) covering the static additive composer (single / multi / empty), user-`buildOutputNode` precedence, `renderOrder` integration and outputNode rebuild on stage-list change — explicit verification that the composer receives ALL pass nodes
- add lookbook demo `stage-postprocessing.astro` — `Stage2D` with `bloom()` via `buildOutputNode`
- add lookbook demo `stage-nested-pipelines.astro` — outer `RootRenderPipeline` automatically composes a bloom-post-processed world layer (nested `StageRenderer` with its own pipeline) and a plain UI pass without an explicit `buildOutputNode`
- document the "one canvas writer per frame" constraint in `packages/twopoint5d/src/stage/README.md` (Mode E section + Common pitfalls): a `RenderPipeline.render()` and a plain `renderer.render(scene, camera)` cannot share the canvas within one frame — compose mixed stages via an outer pipeline instead

### Changed

- change `TextureStore#dispose()` no longer double-disposes its resources. The implicit `on(this, resource)` forwarding that ran `resource.dispose()` from the store's own `OnDispose` was removed; the explicit `for (resource of #resources) resource.dispose()` loop is now the single source of truth
- change `TextureStore#dispose()` and `TextureResource#dispose()` use `SignalGroup.delete(this)` instead of the deprecated `SignalGroup.get(this).destroy()` (also avoids the `TypeError` that happened if the group had already been removed)
- change `TextureResource#dispose()` is now idempotent (guards via an internal `#disposed` flag) — repeated `dispose()` calls are silent no-ops instead of throwing on the already-removed `SignalGroup`
- change `TextureStore#on(id, type, callback)` unsubscribe handler now removes its own `OnDispose` and `OnReady` listeners from the store. Previously each `on()` left a `once(OnDispose, …)` listener and a `once(OnReady, …)` listener that survived unsubscription as inert no-ops, leaking listener slots on stores with many short-lived subscriptions
- change `TextureStore` `defaultTextureClasses` is now backed by a signal with structural compare — mutating the field still works (setter assigns a new array), and identical re-assignments are deduplicated. Public reads/writes have the same shape as before, but the field is now observable internally and stays consistent with the rest of the reactive pipeline
- change `TextureStore#parse()` body is now wrapped in `batch()` so every signal write across all `items[*]` settles before `OnReady` and the per-resource `resource:<id>` events fire — subscribers see a consistent snapshot instead of partial updates
- change `TextureStore#parse()` propagates `item.frameBasedAnimations` into existing tile-set AND atlas resources (previously the existing-resource update path ignored animations; only the first `parse()` honored them via the constructor). Re-parsing with different `frameBasedAnimations` now actually rebuilds the animations
- change `TextureStore#load()` (instance) no longer mutates `data.defaultTextureClasses` (was `splice(0)`, now `slice()`). Re-passing the same `TextureStoreData` to a second `parse()` call now preserves the original defaults
- change `TextureResource.fromImage()` / `fromTileSet()` / `fromAtlas()` no longer mutate the supplied `textureClasses` array (was `splice(0)`, now `slice()`)
- change static `TextureStore.load(url)` now actually awaits `whenReady()` before resolving — previously it returned an already-resolved promise wrapping the un-parsed store, so `const store = await TextureStore.load(url)` did not actually have data when control returned
- change `TextureResource.load()` image-load effect is now an auto-tracking effect (no static deps) so it runs on registration and on every dep change. Previously it had static deps `[#textureFactory, #imageUrl]` which required the factory/URL to change *after* `load()` to ever fire — combined with the new "shared factory injected at parse() time" behavior, the static-dep variant would have left store-managed resources permanently un-loaded
- change `TextureResource.load()` image-load effect protects against stale results: if `imageUrl` (or `textureFactory`) changes while a previous `loadAsync` is still pending, the stale result is discarded and the texture is never assigned. Eliminates a race that would otherwise let an old image overwrite a fresh one and silently leak the new texture
- change `TextureResource.load()` atlas-fetch effect uses `AbortController` — cancelling the effect (dispose or `atlasUrl` change) aborts the in-flight `fetch()` instead of letting it land after teardown
- change `TextureResource.load()` passes `textureClasses` directly to `factory.create(image, ...classes)` so changes to `textureClasses` trigger a texture rebuild via the shared factory. Previously each resource owned its own factory whose constructor baked in the classes; now the store's factory is class-agnostic and resources hand their classes in at create-time
- change `TextureResource` central signal layout: `#frameBasedAnimationsData` and `#frameBasedAnimations` are now created in the field initializer instead of being conditionally instantiated inside `fromTileSet()` / `fromAtlas()`. The `frameBasedAnimationsData` setter is therefore active on every resource type (was a silent no-op for image / atlas resources)
- perf `TextureStore` creates one shared `TextureFactory` per renderer instead of one factory per resource — for `N` resources and a renderer swap, allocations drop from `N` factories to `1`. The store's factory is constructed without `defaultClassNames` (the per-resource `textureClasses` carry the merge already, via `joinTextureClasses(item.texture, store.defaultTextureClasses)`)
- change `TileSet#createTextureCoords()` drops the redundant `tileCountLimit === Infinity` branches in the while-loop guard — `tileCount < Infinity` is always true and the explicit early-out was unreachable when the limit was `Infinity`
- refactor `Display` `on*` event-helper properties (`onResize`, `onRenderFrame`, `onNextFrame`, `onInit`, `onStart`, `onRestart`, `onPause`, `onDispose`): replace the `bind`-with-`unknown`-cast pattern with typed arrow functions. Listener parameter is now `DisplayEventListener` (= `(props: DisplayEventProps) => unknown`), return type is the official `UnsubscribeFunc` from `@spearwolf/eventize`. No runtime change; purely a type-surface cleanup
- change `Display` `EventHandler` type alias removed in favor of a parameterized `DisplayEventListener<T = DisplayEventProps>` so `onDispose` can correctly type its argument as `Display`
- change `Chronometer#stop()` now captures the wall-clock timestamp; `Chronometer#start()` closes the pause-gap in `lostTime` and resets `#currentTime` + `deltaTime` to `0`, so the next `update()` produces a normal small delta even when no `update()` ran during the pause
- change `Chronometer#getCurrentTime` uses `Number.isNaN` instead of the global `isNaN`
- change `Display` constructs its internal `Chronometer` without the `0` seed (`new Chronometer()`), so `timeStart` is anchored to the wall-clock and the new `stop()`/`start()` gap-tracking takes effect
- change `DisplayStateMachine` Start/Pause handlers now pass an explicit `performance.now() / 1000` timestamp to `Chronometer#start()` / `stop()` / `update()` — guarantees a single coherent timestamp per transition
- change `Display[FrameLoop.OnFrame]` forwards the rAF timestamp from `FrameLoop` to `renderFrame()` instead of reading `performance.now()` again
- change `FrameLoop` `maxFps` throttle uses a rastered emit-schedule instead of the previous `now - lastNow >= 0.98 * interval` check — emissions stay on a fixed grid, vsync jitter is tolerated within 2% of the target interval, and long pauses (tab hidden, GC) snap the schedule forward instead of producing a catch-up burst on resume. Fixes the perceptible stutter on 120Hz/240Hz displays when a non-zero `maxFps` is configured
- change `StageRenderer.renderTo()` in pipeline mode always clears the internal pass-target each frame (transparent black, or the user's `clear`-color/alpha when `clear=true`) to avoid frame-content accumulation
- change `StageRenderer#renderFrame(renderer)` → `StageRenderer#renderTo(renderer)` (renamed for `IRenderable` consistency)
- change `StageRenderer#add(stage)` parameter type from `IStage` to `IStage & IRenderable`
- change `StageRenderer.parent` type from `Display | StageRenderer` to `IStageRendererHost | StageRenderer` — any frame-loop host is now accepted
- change `StageRenderer#setClearColor(color, alpha?)` signature: `color: Color | null` (was `Color | null | undefined`); now sets `clear = true` and returns `this`
- change `StageRenderer.renderTo()` clear-state restore: `setClearAlpha` is only called when a clear actually happened — previously the renderer's alpha was overwritten on every frame
- change `StageRenderer` warns via `console.warn` when a stage is added whose `name` is already in use **and** `renderOrder` is non-default (otherwise the sort is ambiguous)
- change `IStage`: drop optional `scene?` / `camera?` (they were unused by the renderer pipeline); `Stage2D` still exposes them as its own properties

### Removed

- remove `Stage2D#clearColor`, `Stage2D#clearAlpha`, `Stage2D#autoClear` — never honored by `StageRenderer`. Use `Scene#background` for per-scene backgrounds or `StageRenderer#setClearColor()` for the renderer-level clear

### Fixed

- fix `TextureStore#parse()` — passing the same `TextureStoreData` object to multiple `parse()` calls now keeps `data.defaultTextureClasses` and every `item.texture` array intact. The previous `.splice(0)` calls consumed the source arrays and the second `parse()` would behave as if `defaultTextureClasses` were empty
- fix `TextureStore.load()` (static) — the promise now resolves after the store has parsed the data, matching what `await TextureStore.load(url)` consumers expect
- fix `TextureStore#dispose()` race + double-dispose — resources are disposed exactly once, signal groups are cleared exactly once, and `dispose()` no longer throws `TypeError: Cannot read properties of undefined (reading 'destroy')` when called more than once on the store or its resources
- fix `TextureResource.load()` no longer leaves store-managed resources stuck without an image. The image-load effect is now an auto-tracking effect that runs on registration; under the previous static-dep + shared-factory combination, the effect's deps were already set at `load()` time so the effect would register but never fire. Symptom in user code: `await store.get(id, 'texture')` hung forever
- fix `TextureResource.load()` image race — a `loadAsync` resolve that lands after the resource was disposed or `imageUrl` changed no longer creates an orphan `Texture`. The created texture is disposed on cleanup; stale resolves are discarded before any signal write
- fix `TextureResource.fromAtlas()` — atlas resources can finally consume `frameBasedAnimations` data. Previously the `#frameBasedAnimationsData` signal was only created for tile-set resources, so the relevant effect in `load()` never had data to consume even though the code path existed
- fix `TextureStore#parse()` — the existing-resource update path for both `tileSet` and `atlasUrl` items now writes `item.frameBasedAnimations` into the resource (was ignored: a second `parse()` could not replace or add animations to an existing resource)
- replace silent `console.error` calls in `TextureStore#load()` and `TextureResource.load()` with structured `'error'` event emissions. Library users can now observe load failures programmatically (`on(store, 'error', listener)` / `on(resource, 'error', listener)`) instead of having a hardcoded `console.error` write into their app's log
- fix `Display#nextFrame` type signature: was incorrectly declared as `Promise<DisplayEventProps>` while the runtime value is a function returning the promise. All call sites already used `await display.nextFrame()` — the new type `() => Promise<DisplayEventProps>` matches that. TS code that wrote `await display.nextFrame` (without parens) was a latent runtime bug and is now flagged at compile time
- fix `Display#onDispose` listener type: was `(props: DisplayEventProps) => any`, but the `OnDisplayDispose` event is emitted with the `Display` instance (per `IOnDisplayDispose`). Handler is now typed as `(display: Display) => unknown`
- fix `Chronometer`: a `stop()` → (no `update()`s during the pause) → `start()` cycle no longer attributes the pause duration to the next `update()` as a giant frame delta — the wall-clock gap is folded into `lostTime` instead, so `time` and `deltaTime` stay continuous across pauses. This was the root cause of "subjective jumps" after `Display.pause = false` and after every `document.visibilitychange` resume
- fix `Display.now` starts at `0` and remains continuous after `start()` — previously it jumped to `performance.now() / 1000` (≈ seconds since page load) on the first `OnDisplayStart` because the internal `Chronometer` was seeded with `0` and the wall-clock gap between construction and start was not tracked
- fix `Display#deltaTime` on `OnDisplayStart` after a `visibilitychange` resume is now `0` (was: the entire hidden-tab duration as a single frame delta)
- fix `FrameLoop`: first emitted `OnFrame` has `deltaTime: 0` instead of `NaN` (the previous conditional `this.#lastNow != null && this.frameNo === 1` was inverted and always fell through to `now - undefined` on the first tick)
- fix `FrameLoop`: `lastNow` in the emitted `OnFrame` props now reflects the previous frame's timestamp instead of being identical to `now` (the `#lastNow = now` assignment used to happen before the `emit()`)
- fix `FrameLoop#measureFps`: the first measurement window is now anchored to the first rAF timestamp instead of using `0` as `measureTimeBegin`, eliminating the bogus ~6 FPS phantom sample that polluted `measuredFps` until the first real 30-frame window completed

### Migration Guide

#### `TextureStore` and `TextureResource` load failures no longer write to `console.error`

If you relied on `console.error` to surface `TextureStore` / `TextureResource` load failures (e.g. by watching the dev-tools console), subscribe to the new `'error'` event instead:

**Before**

```ts
const store = new TextureStore();
store.load('missing.json'); // failures appeared via console.error
```

**After**

```ts
import {on} from '@spearwolf/eventize';
import {TextureStore, TextureStoreEvents} from '@spearwolf/twopoint5d';

const store = new TextureStore();

on(store, 'error', ({source, url, error}) => {
  // source: 'fetch' | 'parse'
  myLogger.warn(`[TextureStore] ${source} failed for ${url}`, error);
});

store.load('missing.json');
```

`TextureResource` emits a similar `'error'` event with `source: 'image' | 'atlas'`.

#### `TextureStore.load(url)` (static) now waits for the data

The static factory used to return a synchronously-wrapped instance — `await TextureStore.load(url)` resolved before the JSON had been fetched and parsed. Now it returns only after the first `OnReady`:

**Before (latent bug)**

```ts
const store = await TextureStore.load('store.json');
// resources were NOT yet present here; you had to also `await store.whenReady()`
```

**After**

```ts
const store = await TextureStore.load('store.json');
// resources are present — equivalent to:
// const store = new TextureStore(); store.load('store.json'); await store.whenReady();
```

If your code did `await store.whenReady()` immediately after `await TextureStore.load(url)`, the second await is now a no-op (still safe, just redundant).

#### `TextureStore#get(id, type)` for unknown ids — opt into `AbortSignal` or `whenResource`

Previously `store.get('does-not-exist', 'texture')` returned a promise that never resolved or rejected. There are now two recommended options to avoid hanging promises:

```ts
// 1) Reject when ready but the id is missing:
const resource = await store.whenResource('hero'); // throws if 'hero' was not declared

// 2) Bound the wait with an AbortController:
const ac = new AbortController();
setTimeout(() => ac.abort(), 5000);
const tex = await store.get('hero', 'texture', {signal: ac.signal});
```

#### `TextureStore` shared `TextureFactory` (and the hard-coded `'nearest'` default is gone)

Each `TextureResource` no longer owns its own `TextureFactory`. The store now creates one `TextureFactory` per renderer and injects it into every managed resource. There is one knock-on behavior change: the per-resource factory used to be constructed as `new TextureFactory(renderer, resourceTextureClasses)` — when `resourceTextureClasses` was `undefined`, the `TextureFactory` constructor's hard-coded `defaultClassNames = ['nearest']` kicked in. The store's shared factory is now built as `new TextureFactory(renderer, [])` (no defaults), and per-resource classes are passed at `factory.create(image, ...classes)` time. Consequence: if a `TextureStore` `item` has no `texture: [...]` AND the store has no `defaultTextureClasses`, the texture is no longer implicitly `nearest`-filtered.

If you relied on the implicit `'nearest'` default, opt back in:

**Option A — set it at the store level once:**

```ts
const store = new TextureStore(renderer);
store.defaultTextureClasses = ['nearest'];
store.load('store.json');
```

**Option B — declare it in the JSON either per-store or per-item:**

```json
{
  "defaultTextureClasses": ["nearest"],
  "items": { "tex": { "imageUrl": "tex.png" } }
}
```

Demos that already specified `"texture": ["srgb"]` (etc.) on the item are unaffected — the explicit per-resource classes are honored exactly as before.

#### `TextureResource.load()` image-load effect now autoruns on registration

Internal change — no API surface affected. The image-load effect inside `TextureResource.load()` is now an auto-tracking effect (no static dep array) so it runs once on registration and re-runs on `textureFactory` / `imageUrl` / `textureClasses` changes. This is necessary because the `TextureStore` now injects the factory at `parse()` time (before `load()` is called), and a static-dep effect would never have fired in that flow. Standalone `TextureResource` usage (`resource.renderer = X`) keeps working because the renderer→factory fallback effect also runs on registration.

#### `Display#nextFrame` is a method, not a promise property

Pure type fix — runtime was always a function. If your code was relying on the (incorrect) `Promise<DisplayEventProps>` declaration and `await`ing the property without calling it, you had a latent runtime bug.

**Before (broken at runtime, allowed by TS)**

```ts
const props = await display.nextFrame; // resolves to the function itself, not a frame!
```

**After**

```ts
const props = await display.nextFrame(); // resolves on the next OnDisplayRenderFrame
```

#### `Display#onDispose` callback receives the `Display`, not `DisplayEventProps`

The `OnDisplayDispose` event has always been emitted with the `Display` instance as its payload (see `IOnDisplayDispose`), but the `onDispose` helper was mistyped to claim it would call your listener with `DisplayEventProps`. If TS let you destructure `{renderer, frameNo, …}` from the argument, that code was relying on runtime-`undefined`s.

**Before**

```ts
display.onDispose(({display, renderer}) => {
  // renderer is undefined at runtime — the emitter passes the Display itself.
});
```

**After**

```ts
display.onDispose((display) => {
  // do cleanup against `display` directly; renderer is on display.renderer
});
```

#### `Chronometer#stop()` / `start()` now track the wall-clock pause-gap

If you were calling `chronometer.stop()` and `chronometer.start()` without `update()` calls during the pause, your `time` and `deltaTime` used to jump on the next `update()` after `start()` (the entire pause was attributed to a single frame). After the fix, the pause-gap is folded into `lostTime` and the next `update()` produces a normal small delta.

For most callers this is purely a bugfix and no code change is needed. If you relied on the old jumping behavior (e.g. for an "elapsed-real-time" counter), use `performance.now()` directly instead.

If you want pause/resume to be anchored to a specific timestamp (for tests, replay, or to stay in lockstep with another clock), pass an explicit `time` argument:

**Before**

```ts
chronometer.stop();  // pausedAt was untracked
chronometer.start(); // pause duration was silently lost
```

**After**

```ts
chronometer.stop(t);   // pausedAt = t
chronometer.start(t2); // lostTime += (t2 - t)
```

#### `Chronometer#start()` resets `deltaTime` to `0`

Previously `start()` left `deltaTime` at its pre-pause value. Now it is `0` until the next `update()` — semantically there has been no active phase since the resume. If you query `chronometer.deltaTime` between `start()` and the next `update()`, you'll now see `0` (was: the last pre-pause delta).

#### `Display.now` no longer jumps on the first frame

`Display.now` (and the `now` field in `OnDisplayRenderFrame` / `OnDisplayStart` event props) now starts at `0` and stays small. Previously it jumped to `performance.now() / 1000` (≈ seconds since page load) on the first frame after `display.start()`. Code that was working around this — e.g. by subtracting the first `now` value to "rebase" the clock — can drop that workaround.

**Before (workaround)**

```ts
let t0: number | null = null;
display.onRenderFrame(({now}) => {
  if (t0 == null) t0 = now;
  const elapsed = now - t0; // rebase against first-frame jump
  // ...
});
```

**After**

```ts
display.onRenderFrame(({now}) => {
  const elapsed = now; // already starts at 0
  // ...
});
```

#### Optional `maxDeltaTime` to clamp frame-spike outliers

New in `Chronometer`. The bare class still defaults to `0` (disabled) so existing direct uses of `Chronometer` are preserved. Set it (in the same unit as your time source — seconds by default) to cap individual `deltaTime` values and fold the overflow into `lostTime`. Useful as a defensive guard against rAF throttling, GC pauses, or debugger breakpoints.

```ts
const c = new Chronometer(undefined, 1 / 30); // cap frame-delta at ~33ms
// or later:
c.maxDeltaTime = 1 / 30;
```

#### `Display` now caps `deltaTime` at `1 / 30` by default

`Display` seeds its internal `Chronometer` with `maxDeltaTime = 1 / 30` (~33ms). Subscribers will no longer see `deltaTime` values larger than that on a single frame — anything beyond is treated as lost time so `display.now` stays continuous. This is the right default for games / animations / physics and matches what most engines do, but it changes observable behavior for callers that consumed the raw "real wall-clock since last frame" value.

**Before**

```ts
display.onRenderFrame(({deltaTime}) => {
  // After a hidden-tab resume or a long GC pause, deltaTime could be
  // several seconds — and your integrator had to deal with it.
});
```

**After (default)**

```ts
display.onRenderFrame(({deltaTime}) => {
  // deltaTime ≤ 1/30; outliers are absorbed by the lost-time accumulator.
});
```

**Opt out (preserve old behavior)**

```ts
display.maxDeltaTime = 0;
```

#### `Display#resizePollIntervalMs` for high-refresh displays

`Display#resize()` runs every frame and forces a layout via `getComputedStyle()` + `getBoundingClientRect()`. On 240Hz monitors that is 240 forced reflows per second and can dominate the frame budget. Default remains `0` (legacy "every frame" behavior); opt in to throttle:

```ts
const display = new Display(canvas);
display.resizePollIntervalMs = 1000 / 60; // measure layout at most ~60Hz
```

The cheap hash-based no-op short-circuit inside `resize()` still applies on every poll, so this only affects the cost of the DOM reads — the renderer is still re-evaluated whenever the size actually changes.

#### Adopting `FixedFrameLoop` for smooth motion on high-refresh displays

Purely additive — existing `display.onRenderFrame(...)` code keeps working unchanged. The opt-in pattern decouples the simulation step (position/physics/animation update) from the render step (interpolation + draw), so the on-screen motion stays smooth even when frame timing varies.

**Before (delta-driven, susceptible to per-frame JS jitter)**

```ts
let x = 0;
display.onRenderFrame(({deltaTime, renderer}) => {
  x += velocity * deltaTime;            // integrated against variable dt
  mesh.position.x = x;
  renderer.render(scene, camera);
});
```

**After (fixed step + interpolation)**

```ts
import {FixedFrameLoop} from '@spearwolf/twopoint5d';

const sim = new FixedFrameLoop(display, {fps: 60});

let prevX = 0;
let currX = 0;

sim.onTick(({fixedDelta}) => {
  prevX = currX;
  currX += velocity * fixedDelta;       // deterministic, fixed step
});

sim.onRender(({alpha, renderer}) => {
  mesh.position.x = prevX + (currX - prevX) * alpha;
  renderer.render(scene, camera);
});
```

The loop subscribes to `Display`'s `OnDisplayRenderFrame` automatically and disposes itself when `Display` disposes. To tear it down earlier (e.g. switching scenes), call `sim.dispose()`.

#### `FrameLoop` `maxFps` cadence is now grid-stable

If you were using `new Display(canvas, {maxFps: N})` with `N` set (e.g. for power-saving on a 60Hz monitor) the emit cadence used to drift slightly with vsync jitter and could miss frames on 120Hz/240Hz monitors. The new rastered schedule keeps emissions on a fixed grid with a 2% jitter tolerance. No code change is required — but if you'd previously dialed `maxFps` to a non-divisor of your refresh rate to dodge the drift, you can now use the natural divisor (e.g. `maxFps: 60` on a 240Hz monitor).

#### `StageRenderer#renderFrame()` renamed to `renderTo()`

`StageRenderer` now implements `IRenderable` along with `IStage`. The render method follows the `IRenderable` contract.

**Before**

```ts
stageRenderer.renderFrame(renderer);
```

**After**

```ts
stageRenderer.renderTo(renderer);
```

#### `StageRenderer` no longer clears when only `clearAlpha = 0` is set

Previously, assigning `clearAlpha = 0` without a `clearColor` implicitly enabled clearing (with the renderer's current color, transparent). With the new explicit `clear` flag this no longer happens — you must opt in.

**Before**

```ts
stageRenderer.clearAlpha = 0; // implicitly cleared with alpha=0
```

**After**

```ts
stageRenderer.setClearColor(null, 0); // explicit transparent clear
// or:
stageRenderer.clear = true;
stageRenderer.clearAlpha = 0;
```

#### `Stage2D` clear properties removed

`Stage2D#clearColor`, `Stage2D#clearAlpha`, and `Stage2D#autoClear` were never read by the renderer pipeline.

**Before**

```ts
const stage = new Stage2D(projection);
stage.clearColor = new Color('#222');
stage.clearAlpha = 1;
stage.autoClear = true;
```

**After (per-stage background)**

```ts
import {Color} from 'three/webgpu';
const stage = new Stage2D(projection);
stage.scene.background = new Color('#222');
```

**After (renderer-level clear, e.g. for the root renderer of a stack)**

```ts
new StageRenderer(display).setClearColor(new Color('#222'), 1).add(stage);
```

#### `StageRenderer#add()` requires `IRenderable`

Any custom stage must now also implement `renderTo(renderer)`. Stages that previously relied on the implicit `scene && camera` path inside `renderStage()` need to expose a `renderTo()` instead:

**Before**

```ts
class MyStage implements IStage {
  name = 'my';
  scene = new Scene();
  camera = new PerspectiveCamera();
  resize() {/* … */}
  updateFrame() {/* … */}
}
```

**After**

```ts
class MyStage implements IStage, IRenderable {
  name = 'my';
  scene = new Scene();
  camera = new PerspectiveCamera();
  resize() {/* … */}
  updateFrame() {/* … */}
  renderTo(renderer: WebGPURenderer) {
    renderer.render(this.scene, this.camera);
  }
}
```

`Stage2D` users do not need to change anything — `Stage2D` ships with `renderTo()`.

#### Driving a `StageRenderer` from `Display`

If you constructed `StageRenderer(display)` **and** subscribed to `OnDisplayRenderFrame` yourself to call `stageRenderer.renderFrame(...)`, you were rendering every frame twice. Pick **one** of the two modes:

**Before (double-driving)**

```ts
const sr = new StageRenderer(display);
on(display, OnDisplayRenderFrame, ({renderer, now, deltaTime, frameNo}) => {
  sr.updateFrame(now, deltaTime, frameNo);
  sr.renderFrame(renderer);
});
```

**After (auto-driven — recommended)**

```ts
const sr = new StageRenderer(display); // updateFrame + renderTo run automatically
```

**After (manual — no `parent`)**

```ts
const sr = new StageRenderer();
on(display, OnDisplayRenderFrame, ({renderer, now, deltaTime, frameNo}) => {
  sr.updateFrame(now, deltaTime, frameNo);
  sr.renderTo(renderer);
});
```

#### Recommended idiom: fluent setup

Not a breaking change (the property-write style still works), but the fluent API documents intent more clearly and reads as one statement.

**Before**

```ts
const sr = new StageRenderer(display);
sr.clearColor = new Color('#90b0d0');
sr.add(stage);
```

**After**

```ts
new StageRenderer(display).setClearColor(new Color('#90b0d0')).add(stage);
```

#### Adopting the new `pipeline` integration

The new `pipeline` integration is purely additive; existing code paths continue to work unchanged. If you were running your own post-pass against the renderer manually, you can fold it into the `StageRenderer`:

**Before (manual pass + render)**

```ts
const sr = new StageRenderer(display).add(stage);
const renderTarget = new RenderTarget(width, height);
const scenePass = pass(stage.scene, stage.camera!);
const pipeline = new RenderPipeline(display.renderer);
pipeline.outputNode = bloom(scenePass);

on(display, OnDisplayRenderFrame, ({renderer}) => {
  renderer.setRenderTarget(renderTarget);
  sr.renderTo(renderer);
  renderer.setRenderTarget(null);
  pipeline.render();
});
```

**After (Mode D via `buildOutputNode`)**

```ts
const sr = new StageRenderer(display).add(stage);
sr.pipeline = new RenderPipeline(display.renderer);
sr.buildOutputNode = ([scenePass]) => bloom(scenePass); // pass is pulled from stage.asPassNode()
```

The renderer manages its own internal `RenderTarget`, sizes it on `resize()` and disposes it with `dispose()`.

#### Intermediate clears between layered stages

If you previously inserted custom rendering steps to clear the depth buffer between world and UI, use `ClearStage` instead.

**Before**

```ts
class _ClearDepth { name = 'cd'; resize(){} updateFrame(){} renderTo(r){ r.clear(false, true, false); } }
root.add(world).add(new _ClearDepth()).add(ui);
```

**After**

```ts
import {ClearStage} from '@spearwolf/twopoint5d';
root.add(world).add(new ClearStage({depth: true})).add(ui); // depth-only is the default
```

See `packages/twopoint5d/src/stage/README.md` for the full layering cheat-sheet.

#### `RootRenderPipeline` shortcut for additive composition

For the most common case — "compose every stage's pass additively as the pipeline output" — use `RootRenderPipeline` instead of `RenderPipeline` and skip `buildOutputNode` entirely.

**Before**

```ts
import {RenderPipeline} from 'three/webgpu';
root.pipeline = new RenderPipeline(display.renderer);
root.buildOutputNode = ([a, b, c]) => a.add(b).add(c); // boilerplate
```

**After**

```ts
import {RootRenderPipeline} from '@spearwolf/twopoint5d';
root.pipeline = new RootRenderPipeline(display.renderer); // additive composition built-in
```

Setting `stageRenderer.buildOutputNode` still overrides the default — use the explicit form when you need a non-additive composition (e.g. `bloom(scenePass)` wrapping a single pass).

#### Composing nested renderers with their own pipeline

Each `StageRenderer` can carry its own pipeline. The outer composition picks them up automatically.

**Before (separate, manually composed)**

```ts
const worldRT = new RenderTarget(w, h);
const worldPipeline = new RenderPipeline(renderer);
worldPipeline.outputNode = bloom(pass(worldScene, worldCamera));
on(display, OnDisplayRenderFrame, ({renderer}) => {
  renderer.setRenderTarget(worldRT);
  worldPipeline.render();
  renderer.setRenderTarget(null);
  // … now blit worldRT.texture as a quad, then render UI on top …
});
```

**After (nested renderers)**

```ts
const root = new StageRenderer(display).setClearColor(new Color('#000'));

const worldRenderer = new StageRenderer(root).add(worldStage);
worldRenderer.pipeline = new RenderPipeline(display.renderer);
worldRenderer.buildOutputNode = ([scene]) => bloom(scene);

root.add(uiStage); // plain on top
```

## [0.20.0] - 2026-05-10

### Added

- add `ChunkQuadTreeNode#clear()`: reset a node back to a fresh empty leaf, dropping every child reference so the subtree becomes GC-eligible — useful for re-builds in tile-streaming scenarios
- add `isDisposed` getter on `VOBufferPool`
- add `dispose()` method to `VOBufferPool` (and the `VertexObjectPool` subclass)
  - releases the underlying typed-array memory eagerly by dropping every reference held in `pool.buffer.buffers` so the `ArrayBuffer`s can be reclaimed by the garbage collector even if downstream `THREE.BufferAttribute`s still hold a transient copy of the array reference — useful for long-running sessions with dynamic pool creation/teardown (e.g. tile streaming)
  - `usedCount` is reset to `0` and `isDisposed` flips to `true`; subsequent `dispose()` calls are no-ops (idempotent)
  - the `VertexObjectPool` override additionally invokes `onDestroyVO` for every still-alive vertex object, unlinks the buffer reference from each tracked VO and drops the internal VO index — VOs that survived earlier `freeVO()` swaps are unlinked too
- add `options.autoDispose` parameter to `InstancedVOBufferGeometry#attachInstancedPool(name, pool, options?)`
  - defaults to `true` — the attached pool is cleared together with the geometry on `dispose()`
  - set to `false` for pools that are shared with other geometries or otherwise managed by the caller
- add JSDoc for the `Display` resize model and the resize-related public API
- add `Display` resize browser tests in `@spearwolf/twopoint5d-testing`
- add ~40 unit tests for `ChunkQuadTreeNode` covering `clear()`, `findChunksAt()` happy paths + missing-quadrant tolerance, the `findChunks(aabb, out)` signature, axis-straddler routing, idempotency of `subdivide()`, the no-axis-splittable bail-out, and a 1k-chunk subdivide stress smoke
- add `AABB2#isInsideAABB` regression tests for asymmetric containers (x/y-swap reproducer)
- add unit-test suite `CameraBasedVisibility.spec.ts` covering visibility classification (create / reuse / remove), dependency-based caching, parallel-camera edge cases, distance-sorted `visibles`, helper contract (`frustumBox` / `box` / `centerWorld` / `map2dTile`), `offset` / `translate` outputs, and a low-GC regression check that the pooled `TileBox` instances are reused across non-cached calls
- add unit tests covering `dispose()` for both `VOBufferPool` and `VertexObjectPool`: idempotency, typed-array release, used-count reset, `onDestroyVO` fan-out (incl. interaction with `freeVO()`), buffer-reference unlinking, and the no-VOs-alive case
- add unit tests for `AnimatedSpritesMaterial` covering construction and the full `dispose()` contract (texture release, no-op on missing `animsMap`, ordering vs. `NodeMaterial#dispose`, signal/effect leak check, idempotent double-dispose)

### Changed

- simplify `AABB2#isNorthWest()` / `isNorthEast()` / `isSouthEast()` / `isSouthWest()` — drop redundant OR clauses, semantics unchanged (all 52 existing quadrant assertions still pass)
- perf `ChunkQuadTreeNode#subdivide()`: O(n²) → O(n × unique-origins) per level — single-pass min instead of `map`/`filter`/`sort`, dedup adjacent origin candidates, eliminate the per-call `Function.prototype.bind`, partition straight into four bucket arrays + straddler list (one pass over chunks, no transient `appendChunk()` round-trip), child nodes take ownership of their bucket arrays without a copy
- perf `ChunkQuadTreeNode#findChunks(aabb, out?)`: optional caller-supplied output array — avoids the per-recursion `Array#concat` allocation chain in hot paths (per-frame visibility queries); chunks are pushed in place
- typecheck `ChunkQuadTreeNode`: `originX`/`originY` and `nodes.{north,south}{East,West}` now correctly typed as `number | null` / `ChunkQuadTreeNode | null` (previously `@ts-ignore`'d to `number` / non-null) — V8 hidden-class stays stable from construction
- perf `CameraBasedVisibility#computeVisibleTiles()`: reduce per-frame GC pressure
  - pool `TileBox` slots (and their `Box3` / `Vector3` / `Map2DTileCoords` shells) by tile id, mutate them in place across frames
  - replace the per-frame `previousTiles.slice(0)` + linear `findIndex` / `splice` (O(n²)) with an id-keyed `Map` lookup (O(n))
  - reuse the `visitedIds` `Set`, the BFS stack, and the `Vector3` / `Vector2` / `Line3` scratch instances instead of reallocating each frame
  - hoist the 8-neighbour offsets to a module constant and walk them with a `for` loop (no per-tile `forEach` callbacks)
  - sort `visibles` once with `Array.sort` instead of a quadratic sorted-insert loop
- upgrade dependencies
  - `@spearwolf/eventize@4.3.1`
  - `@spearwolf/signalize@0.28.0`

### Removed

- remove dummy `number-or-the-beast.test.js` from `@spearwolf/twopoint5d-testing`

### Fixed

- fix `AABB2#isInsideAABB()`: corner-coordinate test no longer swaps x/y — previously an inner aabb whose `top` exceeded the container's width (or whose `left` exceeded the container's height) was reported as outside even when fully contained
- fix `ChunkQuadTreeNode#findChunksAt()`: leaf-guard added — previously every call against a subdivided tree (or a non-subdivided leaf) crashed with a null deref as soon as the recursion descended into a child leaf
- fix `ChunkQuadTreeNode` axis heuristic (`scoreAxis`/`findAxis`): drop the bogus per-call `beforeChunks`/`intersectChunks`/`afterChunks` arrays (chunks were pushed but the entries were the outer chunk argument, not the iterated chunk — the lists were never read but were a latent bug); replace with three integer counters
- fix `Display`: `OnDisplayResize` now fires exactly once per frame (previously double-emitted on the first frame when the constructor measurement and the first-frame measurement differed)
- fix `InstancedVOBufferGeometry#dispose()`: extra instanced pools attached via `attachInstancedPool()` are now actually cleared, and the `extraInstancedBuffers` / `extraInstancedBufferSerials` bookkeeping maps are emptied
- fix `AnimatedSpritesMaterial#dispose()` order: the `animsMap` texture is now released, reset and its signal handle destroyed _before_ `super.dispose()` tears down the `SignalGroup` attached to the material — previously the cleanup relied on signalize's "destroyed signal still returns last value" lenience

### Migration Guide

#### `InstancedVOBufferGeometry#attachInstancedPool()` now disposes attached pools by default

Pools attached via `attachInstancedPool()` are now cleared together with the geometry when `dispose()` is called (previously they leaked — see the `### Fixed` entry above). If a pool is shared with other geometries or otherwise managed by the caller, opt out via `autoDispose: false`.

**Before**

```ts
geom.attachInstancedPool('foo', sharedPool);
geom.dispose(); // sharedPool was leaked
```

**After**

```ts
// shared pool — keep it alive past geom.dispose()
geom.attachInstancedPool('foo', sharedPool, {autoDispose: false});

// owned pool — dispose() will clear it (new default)
geom.attachInstancedPool('bar', ownedPool);
```

## [0.19.0] - 2026-02-27

- upgrade dependencies to `three@0.183.1`

## [0.18.5] - 2026-01-12

- delegate renderer to texture ressources in `TextureStore` on change

## [0.18.4] - 2026-01-08

- refactor TextureStore#dispose() to use SignalGroup#clear() and clear renderer reference

## [0.18.3] - 2026-01-08

- revert back to `three@0.181.2` due to _undefined_ `GPUShaderStage` issues with `three/webgpu` in `0.182.0`
  - see https://github.com/mrdoob/three.js/issues/32529

## [0.18.2] - 2026-01-06

- fix `TextureStore` type mappings for tuple destructuring in `.on()` and `.get()` methods
  - tuple types are now properly preserved instead of being flattened to union types
  - callbacks with destructured parameters now receive correctly typed values
  - added `MapTuple` helper type for recursive tuple mapping
  - applied `const` type parameter modifier to prevent array literal widening

## [0.18.1] - 2026-01-05

- fix import `Camera` as _type_ issue in `Stage2D`

## [0.18.0] - 2026-01-05

- improve type safety in `TextureStore`
  - replace `any` type with mapped types in `.on()` and `.get()` methods
  - add `TextureResourceSubTypeMap` type mapping each `TextureResourceSubType` to its corresponding TypeScript type
  - callbacks now receive properly typed values based on the requested resource type
- fix initial geometry update issue (`instanceCount` is _Infinity_ error) for `TileSprites` managed by a `TileSpritesFactory`
- upgrade dependencies
  - three@0.182.0
  - @spearwolf/signalize@0.25.0

## [0.17.0] - 2025-11-25

- add `frameRate` (fps) option as alternative to `duration` in `FrameBasedAnimations`
  - the `add()` method now accepts either a `duration` number or an `AnimationTimingOptions` object with `frameRate` or `duration`
  - when using `frameRate`, the duration is automatically calculated as `frameCount / frameRate`
  - added validation to ensure `frameRate` is greater than 0
  - updated `TextureResource` to support `frameRate` in declarative animation configuration
- add `anchorPosition` support to `fitIntoRectangle`
  - new types: `AnchorPosition`, `AnchorPositionX`, `AnchorPositionY`
  - new function: `parseAnchorPosition()` - parses anchor position strings into [y, x] components
  - new function: `calculateAnchorOffset()` - computes view offset based on container/view size difference and anchor position
  - updated `FitIntoRectangleSpecs` type to include optional `anchorPosition` property

## [0.16.0] - 2025-11-24

- add `resize(capacity: number): void` method to `VertexObjectPool`
  - enables dynamic capacity adjustment while preserving existing vertex objects
  - validates input: rejects negative or non-integer capacities
  - updates internal buffer references in existing vertex objects
  - adjusts `usedCount` to not exceed the new capacity
- improve `TextureSprites`and `AnimatedSprites`
  - enhance typscript definitions for better type safety and developer experience
  - add `.dispose()` method to free up resources when no longer needed
- enhance `TextureStore` error handling
  - improve error messages for better debugging and user feedback

## [0.15.0] - 2025-11-21

- improve `TextureStore`
  - load and create _frameBasedAnimations_ from _json_
  - The _textureStore_ now also supports the _atlas_ type when creating a _tileSet_.
  - The `textureStore.get()` method has been renamed to `.on()` and a new implementation of `.get()` (which replaces the old one) has been added. The new `.get()` method behaves exactly like `.on()` but returns a promise once.
  - add `.dispose()` method
  - fix an issue that prevented the _textureFactory_ from being created when the _renderer_ property was set very early on
- clean up _events.js_
  - remove obsolete `StageRenderFrameProps` interface

## [0.14.0] - 2025-11-19

- refactor all 'three' imports: use only 'three/webgpu'
- remove obsolete classes:
  - `CustomChunksShaderMaterial`
  - `ShaderLib`
  - `ShaderTool`

## [0.13.0] - 2025-11-18

> [!CAUTION]
> This version breaks with many things and clearly moves towards the use of WebGL2 and WebGPU!
>
> This follows the three.js library, which currently comes in two variants:
> `import THREE from 'three'` _vs._ `import THREE from 'three/webgpu'`
>
> Starting with version `0.13`, `twopoint5d` is freeing itself from legacy issues and moving completely to the `three/webgpu` side!
>
> The new _node materials_ and the _three shader language_ are exactly what was envisioned when `@spearwolf/twopoint5d` was created.
> Instead of getting lost in custom workarounds that use the old materials and shaders, we have now switched exclusively and consistently to _tsl_.

- only use the `three/webgpu` package as import
- upgrade to three.js r181
- refactor `Display` &rarr; `resize`, `renderFrame` events
  - add types, constants and interfaces for `OnDisplayResize` and `OnDisplayRenderFrame`
  - _MIGRATION NOTE:_ the `frame` event has been renamed to `renderFrame`
  - add new helpers:
    - `display.onResize(callback)`
    - `display.onRenderFrame(callback)`
    - `display.onInit(callback)`
    - `display.onStart(callback)`
    - `display.onPause(callback)`
    - `display.onRestart(callback)`
    - `display.onDispose(callback)`
- the types and constants from `/events.js` are now included in the main module
  - _MIGRATION NOTE:_ the import of `@spearwolf/twopoint5d/events.js` is no longer supported. just use `@spearwolf/twopoint5d` instead.
- _MIGRATION NOTE:_ renamed `DisplayEventArgs` to `DisplayEventProps`
- _MIGRATION NOTE:_ dropped `OnResizeProps` and `OnRenderFrameProps`. the only truth is `DisplayEventProps`
- add new constants and types: `OnDisplayInit`, `OnDisplayStart`, `OntDisplayRestart`, `OnDisplayPause` and `OnDisplayDispose`
- The `VertexObjects` mesh is calling `.update()` in the constructor now
  - To avoid disappointment if the vertex object geometry was not manually updated initially.


## [0.12.0] - 2025-05-10

- refactor `IStage`, `PostProcessingRenderer`, add `Stage2DRenderPass`

&mldr;

## [0.11.0] - 2025-04-26

- remove auto creation of `WebGPURenderer` in `Display` when using `webgpu: true`
  - to avoid confusion with `three`and `three/webgpu` imports when using resolve aliases
  - you can still pass `renderer: new WebGPURenderer()` to the `Display` constructor (no need to pass `webgpu: true` in this case)
- convert last `three/examples/jsm` import to `three/addons`
- deactivate some hook tests in twopoint5d-r3f
  - time to ditch react-three-fiber support
    - the maintainance cost is too high

## [0.9.3] - 2025-03-26

- upgrade to `@spearwolf/signalize@0.20.1`

## [0.9.2] - 2025-03-26

- fix `PostProcessingRenderer` resize issues

## [0.9.1] - 2025-03-25

- fix _renderOrder_ '*' behavior

## [0.9.0] - 2025-03-25

- add _renderOrder_ feature to `StageRenderer` and `PostProcessingRenderer`
- the `IStage` interface have a _name_ property now

## [0.7.0] - 2024-01-09

### Added

- The `Display` class now supports the _optional_ `webgpu: true` parameter
  - If enabled, the new `WebGPURenderer` from `three/gpu` is used
  - The default is still the good old `THREE.WebGLRenderer`


## [0.6.0] - 2024-01-08

### Changed

- Use default dependencies instead of peer dependencies


## [0.5.0] - 2024-01-08

### Changed

- Upgrade dependencies
  - three@0.172.0
  - @spearwolf/eventize@4.0.1
  - @spearwolf/signalize@0.18.1
