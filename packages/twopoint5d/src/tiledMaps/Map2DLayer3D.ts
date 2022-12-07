import {Group} from 'three';

import {IMap2DLayer} from './IMap2DLayer';
import {IMap2DTileRenderer} from './IMap2DTileRenderer';
import {IMap2DVisibilitor} from './IMap2DVisibilitor';
import {Map2DLayer} from './Map2DLayer';

/**
 * A fascade that is an `THREE.Object3D` and represents a {@link Map2DLayer}
 */
export class Map2DLayer3D extends Group implements IMap2DLayer {
  #renderers: Set<IMap2DTileRenderer> = new Set();
  #map2dLayer: Map2DLayer;
  #visibilitor?: IMap2DVisibilitor;

  get map2dLayer(): Map2DLayer {
    return this.#map2dLayer;
  }

  set map2dLayer(map2dLayer: Map2DLayer) {
    if (this.#map2dLayer !== map2dLayer) {
      if (this.#renderers.size > 0) {
        if (this.#map2dLayer) {
          for (const renderer of this.#renderers) {
            this.#map2dLayer.removeTileRenderer(renderer);
          }
        }
      }

      this.#map2dLayer = map2dLayer;

      if (this.#visibilitor) {
        this.#map2dLayer.visibilitor = this.#visibilitor;
      }

      if (this.#map2dLayer) {
        for (const renderer of this.#renderers) {
          this.#map2dLayer.addTileRenderer(renderer);
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
      if (this.#map2dLayer != null) {
        this.#map2dLayer.visibilitor = v;
      }
    }
  }

  get centerX(): number {
    return this.#map2dLayer.centerX;
  }

  set centerX(x: number) {
    this.#map2dLayer.centerX = x;
  }

  get centerY(): number {
    return this.#map2dLayer.centerY;
  }

  set centerY(y: number) {
    this.#map2dLayer.centerY = y;
  }

  get tileWidth(): number {
    return this.#map2dLayer.tileWidth;
  }

  set tileWidth(width: number) {
    this.#map2dLayer.tileWidth = width;
  }

  get tileHeight(): number {
    return this.#map2dLayer.tileHeight;
  }

  set tileHeight(height: number) {
    this.#map2dLayer.tileHeight = height;
  }

  get xOffset(): number {
    return this.#map2dLayer.xOffset;
  }

  set xOffset(offset: number) {
    this.#map2dLayer.xOffset = offset;
  }

  get yOffset(): number {
    return this.#map2dLayer.yOffset;
  }

  set yOffset(offset: number) {
    this.#map2dLayer.yOffset = offset;
  }

  constructor(map2dLayer: Map2DLayer = new Map2DLayer()) {
    super();
    this.#map2dLayer = map2dLayer;
  }

  addTileRenderer(renderer: IMap2DTileRenderer): void {
    if (!this.#renderers.has(renderer)) {
      this.#renderers.add(renderer);

      this.#map2dLayer.addTileRenderer(renderer);

      // const rendererObject = renderer.getObject3D();
      // if (rendererObject) {
      //   this.#rendererObjects.set(renderer, rendererObject);
      //   this.add(rendererObject);
      // }

      // eslint-disable-next-line no-console
      console.log('Map2DLayer3D.addTileRenderer', {map2dLayer: this.#map2dLayer, renderer, Map2DLayer3D: this});
      // console.log('Map2DLayer3D.addTileRenderer', {map2dLayer: this.#map2dLayer, renderer, rendererObject, Map2DLayer3D: this});
    }
  }

  removeTileRenderer(renderer: IMap2DTileRenderer): void {
    if (this.#renderers.has(renderer)) {
      this.#renderers.delete(renderer);

      this.#map2dLayer.removeTileRenderer(renderer);

      // const rendererObject = this.#rendererObjects.get(renderer);
      // if (rendererObject) {
      //   this.remove(rendererObject);
      //   this.#rendererObjects.delete(renderer);
      // }

      // eslint-disable-next-line no-console
      console.log('Map2DLayer3D.removeTileRenderer', {
        map2dLayer: this.#map2dLayer,
        renderer,
        // rendererObject,
        Map2DLayer3D: this,
      });
    }
  }

  update(): void {
    this.#map2dLayer.update();
  }

  dispose(): void {
    for (const renderer of this.#renderers) {
      this.removeTileRenderer(renderer);
      renderer.dispose();
    }
  }
}
