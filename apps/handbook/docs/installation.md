---
outline: deep
---

<img src="/images/twopoint5d-700x168.png" style="padding-bottom: 2rem" width="175" height="42" alt="twopoint5d">

# Installation

*twopoint5d* is a JavaScript library for 2.5D rendering in HTML5 Canvas, built on top of [three.js](https://threejs.org/).

The package is delivered in **ES module** format and transpiled for **ES2022**. TypeScript **types** are also included.

In addition to *three.js*, the *twopoint5d* package still requires the two _event-_ and _signal-based_ libraries as peer dependencies:
- [eventize](https://github.com/spearwolf/eventize)
- [signalize](https://github.com/spearwolf/signalize)

There are no other dependencies.


## Install `@spearwolf/twopoint5d`

You can install *twopoint5d* using npm or pnpm:

::: code-group
```bash [npm]
npm install @spearwolf/twopoint5d
```
```bash [pnpm]
pnpm add @spearwolf/twopoint5d
```
:::

## Usage in Your Project

Once installed, you can import and use the library's components in your TypeScript or JavaScript project.

### Basic Setup with `Display`

Here's a minimal example demonstrating how to set up a `Display` and render a simple scene:

```typescript
import { Display } from '@spearwolf/twopoint5d';

const display = new Display({
  width: 800,
  height: 600,
  pixelRatio: window.devicePixelRatio,
});

document.body.appendChild(display.canvas);

display.onRenderFrame.add(({ renderer, scene, camera }) => {
  // Your rendering logic here
  renderer.render(scene, camera);
});

display.start();

// To stop the display loop
// display.stop();
```

### Using Textures and Sprites

This example shows how to load a texture atlas and display a textured sprite:

```typescript
import { Display, TextureStore, TexturedSprites, TextureCoords } from '@spearwolf/twopoint5d';
import { Vector3 } from 'three';

const display = new Display();
document.body.appendChild(display.canvas);

const textureStore = new TextureStore();
textureStore.renderer = display.renderer;

// Assuming you have a texture atlas JSON file (e.g., 'assets/my-atlas.json')
textureStore.load('assets/my-atlas.json');

textureStore.whenReady().then(() => {
  const texturedSprites = new TexturedSprites();
  display.scene.add(texturedSprites.mesh);

  // Get texture coordinates for a named frame from the atlas
  const frameCoords = textureStore.on('my-atlas', 'atlas', (atlas) => {
    const frame = atlas.frame('my_sprite_frame');
    if (frame) {
      const sprite = texturedSprites.add();
      sprite.position.set(0, 0, 0);
      sprite.scale.set(100, 100, 1);
      sprite.setTexCoords(frame.coords);
      texturedSprites.update();
    }
  });

  display.onRenderFrame.add(({ renderer, scene, camera }) => {
    renderer.render(scene, camera);
  });

  display.start();
});
```

Remember to adjust paths and asset names according to your project structure. For more detailed examples and API reference, explore the other sections of this handbook.
