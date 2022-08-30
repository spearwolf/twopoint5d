import {
  TileSpritesGeometry,
  TileSpritesMaterial,
  TileSprites,
} from "@spearwolf/tiled-maps";

export class BasicLayerTilesRenderer {
  constructor(tilesData, tileSet, texture, capacity = 1000) {
    this.tilesData = tilesData;
    this.tileSet = tileSet;

    const geometry = new TileSpritesGeometry(capacity);

    const material = new TileSpritesMaterial({
      colorMap: texture,
    });

    material.depthTest = true;
    material.depthWrite = true;

    this.mesh = new TileSprites(geometry, material);
    this.mesh.frustumCulled = false;

    this.tiles = new Map();

    this.renderSerial = 0;
  }

  getObject3D() {
    return this.mesh;
  }

  get instancedPool() {
    return this.mesh?.geometry?.instancedPool;
  }

  beginUpdate(layer, xOffset, yOffset, fullViewArea) {
    console.log("beginUpdate", layer, xOffset, yOffset, fullViewArea);

    this.layer = layer;
    this.mesh?.position.set(xOffset, 0, yOffset);

    this.renderSerial = 0;
  }

  endUpdate() {
    console.log("endUpdate, serial=", this.renderSerial);

    if (this.renderSerial) {
      this.mesh.geometry.touch("quadSize", "texCoords", "instancePosition");
    }
  }

  removeTile(tile) {
    console.log("removeTile", tile);

    const sprite = this.tiles.get(tile.id);
    if (sprite) {
      this.instancedPool.freeVO(sprite);
      this.tiles.delete(tile.id);
      ++this.renderSerial;
    }
  }

  addTile(tile) {
    const tileId = this.tilesData.getTileIdAt(tile.x, tile.y);

    if (tileId === 0) {
      return;
    }

    const sprite = this.instancedPool.createVO();

    sprite.setQuadSize([tile.view.width, tile.view.height]);
    sprite.setInstancePosition([tile.view.left, 0, tile.view.top]);

    const frameId = this.tileSet.frameId(tileId);
    const texCoords = this.tileSet.atlas.get(frameId).coords;

    sprite.setTexCoords([texCoords.s, texCoords.t, texCoords.u, texCoords.v]);

    this.tiles.set(tile.id, sprite);

    ++this.renderSerial;

    console.log("addTile", tile, sprite);
  }

  reuseTile(tile) {
    console.log("reuseTile", tile);
  }
}
