# **picimo**

Welcome to *picimo* &mdash; the 2.5D *sprite* :space_invader::joystick: engine _on top of_ { [three.js](https://threejs.org/) + [react](https://reactjs.org/) &#8658; [react-three-fiber](https://github.com/pmndrs/react-three-fiber) }

> *pic&mdash;i&ndash;mo* is an acronym for _**pictures in motion**_

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

- [x] `<TextureAtlas>`
- [x] `useTextureAtlas()`
- [x] `useTextureLoader()`
- [ ] `<TileSet>`
- [x] `useTileSet()`
- [x] `useTileSetLoader()`
- [x] `<TextureRef>`
- [x] `useTextureRef()`
- [x] `<TextureStore>`

### sprites

- [x] `<TexturedSprites>`
- [x] `<TexturedSpritesGeometry>`
- [x] `<TexturedSpritesMaterial>`
- [ ] `<AnimatedSprites>`
- [ ] `<AnimatedSpritesGeometry>`
- [ ] `<AnimatedSpritesMaterial>`

### utils

- [x] `useAsyncEffect()`
- [x] `useFrameLoop()`
- [x] `<ShaderChunks>`



:rocket: have fun!
