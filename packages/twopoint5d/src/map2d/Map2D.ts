import {Group} from 'three/webgpu';
import type {IMap2DTileRenderer} from './IMap2DTileRenderer.js';
import type {IMap2DVisibilitor} from './IMap2DVisibilitor.js';
import {Map2DTileStreamer} from './Map2DTileStreamer.js';

/**
 * A high-level wrapper class that represents a complete 2D map in a 3D scene.
 *
 * The Map2D class serves as the main component for 2D map systems, providing a user-friendly
 * interface that encapsulates the complex tile streaming functionality. It extends Three.js Group,
 * making it compatible with the standard Three.js scene graph and allowing direct integration
 * into 3D scenes.
 *
 * **Core Responsibilities:**
 * - **Three.js Integration**: Can be directly added to Three.js scenes as a Group object
 * - **Central Coordination**: Manages the relationship between tile renderers and the tile streamer
 * - **Simplified API**: Provides an easy-to-use interface for complex tile streaming operations
 * - **Lifecycle Management**: Handles automatic synchronization and cleanup of resources
 *
 * **Architecture:**
 * - Delegates tile streaming logic to an internal `Map2DTileStreamer`
 * - Manages a collection of `IMap2DTileRenderer` instances that handle actual tile rendering
 * - Coordinates with an `IMap2DVisibilitor` to determine tile visibility
 * - Automatically synchronizes all components when properties change
 *
 * **Typical Usage:**
 * ```typescript
 * // Create a map with default tile streamer
 * const map = new Map2D();
 *
 * // Configure tile rendering
 * map.addTileRenderer(myTileRenderer);
 * map.visibilitor = new RectangularVisibilityArea(800, 600);
 *
 * // Configure tile grid
 * map.tileWidth = 64;
 * map.tileHeight = 64;
 *
 * // Add to Three.js scene
 * scene.add(map);
 *
 * // Update in render loop
 * function animate() {
 *   map.centerX = camera.position.x;
 *   map.centerY = camera.position.z;
 *   map.update();
 *   renderer.render(scene, camera);
 * }
 * ```
 *
 * **Performance Benefits:**
 * - Only loads tiles within the visible area
 * - Automatically unloads tiles that are no longer visible
 * - Reuses existing tiles when possible
 * - Manages memory efficiently for large 2D worlds
 *
 * @extends Group - Three.js Group for scene graph integration
 */
export class Map2D extends Group {
  #renderers: Set<IMap2DTileRenderer> = new Set();
  #tileStreamer: Map2DTileStreamer;
  #visibilitor?: IMap2DVisibilitor;

  get tileStreamer(): Map2DTileStreamer {
    return this.#tileStreamer;
  }

  set tileStreamer(streamer: Map2DTileStreamer) {
    if (this.#tileStreamer !== streamer) {
      if (this.#renderers.size > 0) {
        if (this.#tileStreamer) {
          for (const renderer of this.#renderers) {
            this.#tileStreamer.removeTileRenderer(renderer);
          }
        }
      }

      this.#tileStreamer = streamer;

      if (this.#visibilitor) {
        this.#tileStreamer.visibilitor = this.#visibilitor;
      }

      if (this.#tileStreamer) {
        for (const renderer of this.#renderers) {
          this.#tileStreamer.addTileRenderer(renderer);
        }
      }
    }
  }

  get visibilitor(): IMap2DVisibilitor {
    return this.#visibilitor;
  }

  set visibilitor(v: IMap2DVisibilitor) {
    if (this.#visibilitor !== v) {
      this.#visibilitor?.removeFromScene(this);
      this.#visibilitor = v;
      this.#visibilitor?.addToScene(this);
      if (this.#tileStreamer != null) {
        this.#tileStreamer.visibilitor = v;
      }
    }
  }

  get centerX(): number {
    return this.#tileStreamer.centerX;
  }

  set centerX(x: number) {
    this.#tileStreamer.centerX = x;
  }

  get centerY(): number {
    return this.#tileStreamer.centerY;
  }

  set centerY(y: number) {
    this.#tileStreamer.centerY = y;
  }

  get tileWidth(): number {
    return this.#tileStreamer.tileWidth;
  }

  set tileWidth(width: number) {
    this.#tileStreamer.tileWidth = width;
  }

  get tileHeight(): number {
    return this.#tileStreamer.tileHeight;
  }

  set tileHeight(height: number) {
    this.#tileStreamer.tileHeight = height;
  }

  get xOffset(): number {
    return this.#tileStreamer.xOffset;
  }

  set xOffset(offset: number) {
    this.#tileStreamer.xOffset = offset;
  }

  get yOffset(): number {
    return this.#tileStreamer.yOffset;
  }

  set yOffset(offset: number) {
    this.#tileStreamer.yOffset = offset;
  }

  constructor(tileStreamer: Map2DTileStreamer = new Map2DTileStreamer()) {
    super();
    this.#tileStreamer = tileStreamer;
  }

  addTileRenderer(renderer: IMap2DTileRenderer): void {
    if (!this.#renderers.has(renderer)) {
      this.#renderers.add(renderer);

      this.#tileStreamer.addTileRenderer(renderer);

      // const rendererObject = renderer.getObject3D();
      // if (rendererObject) {
      //   this.#rendererObjects.set(renderer, rendererObject);
      //   this.add(rendererObject);
      // }
    }
  }

  removeTileRenderer(renderer: IMap2DTileRenderer): void {
    if (this.#renderers.has(renderer)) {
      this.#renderers.delete(renderer);

      this.#tileStreamer.removeTileRenderer(renderer);

      // const rendererObject = this.#rendererObjects.get(renderer);
      // if (rendererObject) {
      //   this.remove(rendererObject);
      //   this.#rendererObjects.delete(renderer);
      // }
    }
  }

  update(): void {
    this.updateMatrixWorld();
    this.#tileStreamer.update(this);
  }

  resetTiles(): void {
    this.#tileStreamer.resetTiles();
  }

  dispose(): void {
    for (const renderer of this.#renderers) {
      this.removeTileRenderer(renderer);
      renderer.dispose();
    }
  }
}
