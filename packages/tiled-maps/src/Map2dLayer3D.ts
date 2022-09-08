import {Group, Object3D} from 'three';

import {IMap2DLayerTilesRenderer} from './IMap2dLayerTilesRenderer';

import {Map2DLayer} from './Map2dLayer';

/**
 * A fascade that is an `THREE.Object3D` and represents a {@link Map2DLayer}
 */
export class Map2DLayer3D extends Group {
  #renderers: Set<IMap2DLayerTilesRenderer> = new Set();
  #rendererObjects: Map<IMap2DLayerTilesRenderer, Object3D> = new Map();
  #map2dLayer: Map2DLayer;

  get map2dLayer(): Map2DLayer {
    return this.#map2dLayer;
  }

  set map2dLayer(map2dLayer: Map2DLayer) {
    if (this.#renderers.size > 0) {
      if (this.#map2dLayer) {
        for (const renderer of this.#renderers) {
          this.#map2dLayer.removeTilessRenderer(renderer);
        }
      }
    }

    this.#map2dLayer = map2dLayer;

    if (this.#map2dLayer) {
      for (const renderer of this.#renderers) {
        this.#map2dLayer.addTilesRenderer(renderer);
      }
    }
  }

  get width(): number {
    return this.#map2dLayer.width;
  }

  set width(width: number) {
    this.#map2dLayer.width = width;
  }

  get height(): number {
    return this.#map2dLayer.height;
  }

  set height(height: number) {
    this.#map2dLayer.height = height;
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

  addTilesRenderer(renderer: IMap2DLayerTilesRenderer): void {
    if (!this.#renderers.has(renderer)) {
      this.#renderers.add(renderer);

      this.#map2dLayer.addTilesRenderer(renderer);

      const rendererObject = renderer.getObject3D();
      if (rendererObject) {
        this.#rendererObjects.set(renderer, rendererObject);
        this.add(rendererObject);
      }
    }
  }

  removeTilesRenderer(renderer: IMap2DLayerTilesRenderer): void {
    if (this.#renderers.has(renderer)) {
      this.#renderers.delete(renderer);

      this.#map2dLayer.removeTilessRenderer(renderer);

      const rendererObject = this.#rendererObjects.get(renderer);
      if (rendererObject) {
        this.remove(rendererObject);
        this.#rendererObjects.delete(renderer);
      }
    }
  }

  update(): void {
    this.#map2dLayer.update();
  }

  dispose(): void {
    for (const renderer of this.#renderers) {
      this.removeTilesRenderer(renderer);
      renderer.dispose();
    }
  }
}
