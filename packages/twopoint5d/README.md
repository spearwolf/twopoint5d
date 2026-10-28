<p align="center">
  <img width="400" height="84" src="twopoint5d-logo.png">
	<br>
  <em>a library to create 2.5d realtime graphics and pixelart with three.js</em>
</p>

---

![npm (scoped)](https://img.shields.io/npm/v/%40spearwolf/twopoint5d)

please see the [project README](../../README.md) for a general description of this project,
and the [CHANGELOG](CHANGELOG.md) for what changed from release to release.

---

## What's on the menu

Everything draws through three.js with WebGPU and falls back to WebGL 2 where a browser has
no WebGPU.

### 🍱 Sprites

Thousands of textured sprites in 3D space, drawn in a single draw call.

- **Sprites à la carte.** A sprite kind is put together from small features. Pick the ones
  you need, take a ready-made kind, or write a feature of your own.
- **Standing, lying, facing the camera.** Sprites stand upright in the scene, lie flat on the
  ground, turn freely in space, or face the camera as billboards. You can swap the placement
  while the scene is running.
- **Upright about an axis.** Trees, grass and torches face the camera but stay rooted to the
  ground, the way old-school 3D shooters drew them.
- **Eight-way sprites.** A sprite picks one of several pre-rendered views by the angle the
  camera looks at it from.
- **Ropes, chains and lasers.** A sprite stretched between two points, with its texture
  repeating along the length instead of stretching.
- **Animation.** Frame-based animations that loop, play once or play back and forth, with
  its own duration for every frame.
- **Shadows and reflections.** The same sprites drawn again as a shadow cast by a light or as
  a mirror image on a plane. Both follow the lights and planes of the scene.
- **Flip and anchor.** Sprites mirror horizontally or vertically and turn about any pivot,
  such as the feet, the hilt of a sword or the hinge of a door.
- **Nine-slice panels.** UI frames and buttons that scale to any size while their corners
  keep their shape.
- **Waves.** Grass and banners sway, and lines of text roll along a sine like the scrollers
  of the old Amiga demos.
- **Fade and flash.** Sprites fade in and out, or flash white or in any colour when hit.
- **Palette swap and colour cycling.** One sprite sheet in many colour variants, and
  palettes that rotate for water, fire and the classic copper look.
- **Tint, trim and turned frames.** Sprites are coloured per instance. Frames that a packer
  trimmed or turned in the atlas come out in their original place and orientation.
- **Glow.** A recipe for emissive sprites such as neon and light sabers, made with bloom.
- **Draw order.** Sprites sort back to front, by depth or by any key of your own, so
  transparent sprites blend correctly.
- **Growing pools.** A full pool of sprites grows on demand instead of turning sprites away.
- **Picking.** Finds the sprite under the mouse pointer on the GPU, exactly to the pixel.

### 🗺️ Texture atlases and tilesets

- **One catalog for everything.** Images, atlases, tilesets and animations are loaded from
  one JSON file. Every image is fetched once, however often it is used.
- **The common packers.** TexturePacker, free-tex-packer and Aseprite, where Aseprite tags
  become animations. Other formats plug in through an adapter.
- **Atlases built at run time.** Labels, icons and portraits are packed into one texture
  while the app runs. Sprites use them like frames of any other atlas.
- **Tilesets** are cut from plain images.
- **Atlas frames on your own meshes.** A frame repeats across any surface, wrapped without
  seams.
- **Pixel-crisp or smooth.** Every texture can be set up for sharp pixel art or for smooth,
  anisotropic filtering, and to tile across a surface.

### 🔤 Text

- **Bitmap fonts** in the AngelCode BMFont format, in its text, XML and JSON flavours.
- **Text as sprites.** Kerned, aligned and wrapped text, one sprite per glyph, so every letter
  can be moved, coloured or waved on its own.
- **Measuring** text before it is drawn.

### 🧱 Tile maps

- **Endless 2D tile maps**, streamed in around the camera.
- **Visibility** is worked out from the camera's view or from a plain rectangle, nearest
  tiles first. A camera that stands still costs nothing.
- **Spatial indexes** for fast lookups in large maps.
- How a map is put together: [the tile map guide](docs/map2d.md).

### ⚙️ Vertex objects, the engine room

- **Your own instanced geometry** is described once, then created, changed and deleted as
  plain objects, with no buffer bookkeeping.
- **Settles without garbage.** Once a scene is running, the hot paths allocate no memory.
- **Sorting and growing** come with every pool.

### 🎬 Stages and projections

- **Responsive scenes.** You describe the view, and the library keeps it fitted to the
  canvas: filled, contained or covered, at a whole-pixel zoom when you want one.
- **Orthographic and parallax** projections.
- **Several stages in one frame**, layered and nested.
- **Post-processing** with a node-based pipeline. Bloom is built in.
- **2D canvas on a sprite.** Whatever you draw on an HTML canvas shows up in the scene and
  is uploaded again after every change.

### 🖥️ Display

- **A canvas, ready to go.** Renderer, resizing and the frame loop are taken care of, and a
  fixed timestep is available for game logic.
- **Resolution under control.** Pixel art renders at its own resolution and is scaled up
  crisp. The pixel ratio is capped and multisampling is off unless you ask for it, so
  high-density phone screens stay affordable.
- **Holds its frame rate.** A budget of pixels keeps large screens affordable, and with
  `adaptiveResolution: true` the display measures what every frame costs the GPU and
  draws fewer or more pixels to stay at 60 frames per second.
- **A good starting point** for your three.js demos.

### 🎮 Controls

- **Panning** with mouse drag and the WASD keys, whatever the keyboard layout.
- **A base for your own controls**, which cleans up its listeners when you are done.

### 🧹 Tidy resources

- **Clear ownership.** It is always clear who frees which geometry, material and texture.
  Cleaning up twice does no harm.

---

## Taste it

- the **LOOKBOOK**, a gallery of runnable demos: `pnpm lookbook` in a clone of this
  repository, see the [project README](../../README.md)
- the guides: [sprites](docs/sprites.md), [text](docs/text.md), [tile maps](docs/map2d.md),
  [stages](docs/stages.md), [display: resolution and frame rate](docs/display.md),
  [textures: texture classes](docs/textures.md),
  [resource lifecycle](docs/resource-lifecycle.md),
  [architecture](docs/architecture.md)

have fun! :rocket:
