<p align="center">
  <img width="350" src="../../docs/images/twopoint5d-700x168.png">
	<br>
  <em>a 2.5d realtime gfx library built with three.js, react and @react-three/fiber</em>
</p>

---

please see [../README](../../README.md) for a general description of this project.

> ‼️ ATTENTION! The components for react-three-fiber still work and are documented and used in the LOOKBOOK.
>
> HOWEVER, development is currently ON HOLD.
> Unfortunately, it has happened far too often in the past that an update of the react-three-fiber library has led to incompatibilities with other libraries (especially the @react-three/test-renderer currently used for testing). keeping up with this is far too resource-intensive for me.
> I think it makes more sense to design the vanilla API so that it can be used without a wrapper within the react universe.
>
> However, if you are having fun with r3f, you might find something useful here.
> 
> _Note to self:_ the react components need to be refactored to use the new texture-store from the core library (the new texture-store is also much more complete than this one).

---

The idea is roughly the following:

![twopoint5d-r3f preview](preview.png)


## API Overview

_is checked when implemented and ready to use_

### stages

- [x] `<Stage2D>`
  - [ ] `renderToTexture` property
  - [x] `<GetStage2D>`
  - [x] `useStage2D()`
  - [x] `useStageSize()`
  - [x] `useStageResize()`
- [ ] stage *director/composer* &rarr; stage *effects/layers*

### projections

- [x] `<ParallaxProjection>`
- [ ] `<OrthographicProjection>`
- [ ] `<IsometricProjection>`

### textures

- [x] `<AssetStore>`
- [x] `<TextureAtlas>`
- [x] `<TextureRef>`
- [x] `<TileSet>`
- [x] `<TileSetRef>`
- [x] `useTexture()`
- [x] `useTextureAtlas()`
- [x] `useTextureLoader()`
- [x] `useTileSet()`
- [x] `useTileSetLoader()`

### sprites

- [x] `<TexturedSprites>`
- [x] `<TexturedSpritesGeometry>`
- [x] `<TexturedSpritesMaterial>`
- [ ] `<AnimatedSprites>`
- [ ] `<AnimatedSpritesGeometry>`
- [ ] `<AnimatedSpritesMaterial>`

### map2D

- [x] `<RepeatingTilesProvider>`
- [x] `<Map2DLayer3D>`
- [x] `<Map2DTileSprites>`
- [x] `<TileSpritesGeometry>`
- [x] `<TileSpritesMaterial>`

### controls

- [x] `<PanControl2D>`

### utils

- [x] `useAsyncEffect()`
- [x] `useFrameLoop()`
- [x] `<ShaderChunks>`


have fun! 🚀
