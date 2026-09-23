import type {BufferGeometry, MeshBasicMaterial} from 'three/webgpu';
import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {TileSpritesGeometry} from './TileSpritesGeometry.js';
import type {TileSpritesMaterial} from './TileSpritesMaterial.js';

/**
 * The mesh that draws the tiles of a map, one instance of its `TileSpritesGeometry` per tile.
 *
 * `GeoType` is the geometry the mesh holds. Built without one, the mesh holds the plain
 * `BufferGeometry` that `THREE.Mesh` puts in its place — `GeoType` is then `BufferGeometry`, and
 * `TileSpritesFactory#createTile()` answers `noTileCapacity` for every tile. A type argument
 * named explicitly while the geometry is left out states a geometry the mesh does not hold. The
 * constructor takes any `BufferGeometry`; built with one that is not a `TileSpritesGeometry`, the
 * mesh is like one built without a geometry — `TileSpritesFactory#createTile()` answers
 * `noTileCapacity` there too.
 */
export class TileSprites<GeoType extends TileSpritesGeometry | BufferGeometry = BufferGeometry> extends VertexObjects<GeoType> {
  // built without a material, the mesh holds the MeshBasicMaterial THREE.Mesh puts in its place
  declare material: TileSpritesMaterial | MeshBasicMaterial | undefined;

  constructor(geometry?: GeoType, material?: TileSpritesMaterial) {
    super(geometry, material);

    this.name = 'twopoint5d.TileSprites';
  }
}
