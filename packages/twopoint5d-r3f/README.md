<p align="center">
  <img width="350" src="../../docs/images/twopoint5d-700x168.png">
	<br>
  <b>The Art of Tiling 2D Sprites</b>
	<br>
  <em>A refreshingly satisfying 2.5D graphics library built on three.js, react and @react-three/fiber</em>
</p>

---

please see [../README](../../README.md) for a general description of this project.

---

The idea is roughly the following:

```jsx
export default () => {
  const geometry = useRef();
  const textureAtlas = useTextureAtlas("foo-atlas");

  useFrameLoop(
    {
      init({ geometry, textureAtlas, state, delta }) {
        // your code goes here
      },

      update({ geometry: { currentValue, previousValue }, textureAtlas.. }) {
        // your code goes here
      },

      frame({ geometry, textureAtlas, state, delta }) {
        // your code goes here
      },

      dispose({ geometry, textureAtlas }) {
        // your code goes here
      },
    },
    { geometry: forwardRefValue(geometry), textureAtlas }
  );

  return (
    <Stage2D renderToTexture="stage0">
      <ParallaxProjection
        attach="projection"
        width="640"
        height="480"
        fit="contain"
      />

      <TextureAtlas name="foo-atlas" url="foo-atlas.json" />

      <TexturedSprites>
        <TexturedSpritesGeometry ref={geometry} />
        <TexturedSpritesMaterial>
          <TextureRef name="foo-atlas" attach="colorMap" />
        </TexturedSpritesMaterial>
      </TexturedSprites>
    </Stage2D>
  );
};
```


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


have fun!
:rocket:
