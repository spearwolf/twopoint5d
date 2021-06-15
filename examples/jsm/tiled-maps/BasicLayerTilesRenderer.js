import { TexturedSpritesGeometry } from "../textured-sprites/TexturedSpritesGeometry.js";
import { TexturedSpritesMaterial } from "../textured-sprites/TexturedSpritesMaterial.js";
import { TexturedSprites } from "../textured-sprites/TexturedSprites.js";

export class BasicLayerTilesRenderer {
  constructor(tilesData, tileSet, texture, capacity = 1000) {
    this.tilesData = tilesData;
    this.tileSet = tileSet;

    const geometry = new TexturedSpritesGeometry(
      capacity,
      [0.5, 0.5, 0.5, 0.5]
    );

    const material = new TexturedSpritesMaterial({
      colorMap: texture,
    });

    material.depthTest = true;
    material.depthWrite = true;

    this.mesh = new TexturedSprites(geometry, material);
    this.mesh.frustumCulled = false;

    this.tiles = new Map();

    this.frameSerial = 0; // TODO remove me
  }

  get instancedPool() {
    return this.mesh?.geometry?.instancedPool;
  }

  beginRender(layer, fullViewArea) {
    if (this.frameSerial < 2) {
      console.log("beginRender", layer, fullViewArea);
    }
    this.layer = layer;
    this.renderSerial = 0;
  }

  endRender() {
    if (this.frameSerial < 2) {
      console.log("endRender, serial=", this.renderSerial);
    }
    if (this.renderSerial) {
      this.mesh.geometry.touch("quadSize", "texCoords");
    }
    ++this.frameSerial;
  }

  removeTile(tile) {
    if (this.frameSerial < 2) {
      console.log("removeTile", tile);
    }
    const sprite = this.tiles.get(tile.id);
    if (sprite) {
      this.instancedPool.freeVO(sprite);
      this.tiles.delete(tile.id);
      ++this.renderSerial;
    }
  }

  addTile(tile) {
    const sprite = this.instancedPool.createVO();

    sprite.setQuadSize([tile.view.width, tile.view.height]);
    sprite.setInstancePosition([tile.view.left, tile.view.top, 0]);

    const tileIds = this.tilesData.getTileIdsWithin(
      tile.x + tile.view.width / 2,
      tile.y + tile.view.height / 2,
      1,
      1
    );
    const frameId = this.tileSet.frameId(tileIds[0]);
    const texCoords = this.tileSet.atlas.get(frameId).coords;

    sprite.setTexCoords([texCoords.s, texCoords.t, texCoords.u, texCoords.v]);

    this.tiles.set(tile.id, sprite);

    ++this.renderSerial;

    if (this.frameSerial < 2) {
      console.log("addTile", tile, sprite);
    }
  }

  reuseTile(tile) {
    if (this.frameSerial < 2) {
      console.log("reuseTile", tile);
    }
  }
}
