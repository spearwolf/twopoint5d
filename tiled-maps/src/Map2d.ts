import {Object3D} from 'three';

import {Map2dLayer} from './Map2dLayer';

export class Map2d {
  readonly obj3d = new Object3D();

  get name(): string {
    return this.obj3d.name;
  }

  set name(name: string) {
    this.obj3d.name = name;
  }

  #layers: Array<Map2dLayer> = [];

  addLayer(layer: Map2dLayer): void {
    if (this.#layers.indexOf(layer) === -1) {
      this.#layers.push(layer);
    }
  }

  removeLayer(layer: Map2dLayer): void {
    const idx = this.#layers.indexOf(layer);
    if (idx !== -1) {
      this.#layers.splice(idx, 1);
      const layerObj3d = this.#getObject3D(layer);
      if (layerObj3d) {
        this.obj3d.remove(layerObj3d);
      }
    }
  }

  update(): void {
    this.#layers.forEach((layer) => {
      const layerObj3d = this.#getObject3D(layer);
      if (layerObj3d) {
        if (this.obj3d.children.indexOf(layerObj3d) === -1) {
          this.obj3d.add(layerObj3d);
        }
      }
      layer.update();
    });
  }

  #getObject3D = (layer: Map2dLayer): Object3D => layer.tilesRenderer?.getObject3D();
}
