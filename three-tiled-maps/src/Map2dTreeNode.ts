import {AABB2} from './AABB2';
import {IMap2dRenderable} from './IMap2dRenderable';
import {Map2dTree} from './Map2dTree';

export class Map2dTreeNode<Renderable extends IMap2dRenderable> {
  renderables: Array<Renderable>;
  children: Array<Map2dTreeNode<Renderable>>;
  parent?: Map2dTreeNode<Renderable>;

  readonly tree: Map2dTree<Renderable>;

  constructor(
    tree: Map2dTree<Renderable>,
    renderables: Array<Renderable> = [],
    children: Array<Map2dTreeNode<Renderable>> = [],
  ) {
    this.tree = tree;
    this.renderables = renderables;
    this.children = children;
  }

  aabbNeedsUpdate = false;

  #aabb?: AABB2;

  set aabb(aabb: AABB2) {
    this.#aabb = aabb;
    this.aabbNeedsUpdate = false;
  }

  get aabb(): AABB2 {
    if (this.#aabb == null || this.aabbNeedsUpdate) {
      this.#aabb ??= new AABB2();
      const aabbs = this.renderables
        .map((renderable) => renderable.aabb)
        .concat(this.children.map((child) => child.aabb));
      if (aabbs.length === 0) {
        this.#aabb.set(0, 0, 0, 0);
      } else {
        this.#aabb.copy(aabbs.shift());
        aabbs.reduce((aabb, current) => aabb.extend(current), this.#aabb);
        this.adaptToTileCoords(this.#aabb);
      }
      this.aabbNeedsUpdate = false;
    }
    return this.#aabb;
  }

  private adaptToTileCoords(aabb: AABB2) {
    const coords = this.tree.tileCoordsUtil.computeTilesWithinCoords(
      aabb.left,
      aabb.top,
      aabb.width,
      aabb.height,
    );
    aabb.set(coords.left, coords.top, coords.width, coords.height);
    return aabb;
  }

  // private isLeafTile(aabb: AABB2) {
  //   const coords = this.tree.tileCoordsUtil.computeTilesWithinCoords(
  //     aabb.left,
  //     aabb.top,
  //     aabb.width,
  //     aabb.height,
  //   );
  //   return coords.rows === 1 && coords.columns === 1;
  // }

  isEmpty() {
    return this.renderables.length === 0 && this.children.length === 0;
  }

  add(renderable: Renderable) {
    const renderableAABB = this.adaptToTileCoords(renderable.aabb.clone());
    const {aabb: nodeAABB} = this;

    if (this.isEmpty()) {
      this.renderables.push(renderable);
      nodeAABB.copy(renderableAABB);
      return;
    }

    if (nodeAABB.isEqual(renderableAABB)) {
      this.renderables.push(renderable);
      return;
    }

    if (renderableAABB.isInsideAABB(nodeAABB)) {
      const newChildNode = new Map2dTreeNode<Renderable>(
        this.tree,
        this.renderables,
        this.children,
      );
      newChildNode.parent = this;
      newChildNode.aabb = nodeAABB.clone();

      this.renderables = [renderable];
      this.children = [newChildNode];
      this.#aabb.copy(renderableAABB);
      return;
    }

    const childNode = this.children.find((node) => node.aabb.isInsideAABB(renderableAABB));
    if (childNode) {
      childNode.add(renderable);
      return;
    }

    const childrenInsideRenderable: Array<Map2dTreeNode<Renderable>> = [];

    this.children.filter((childNode) => {
      if (renderableAABB.isInsideAABB(childNode.aabb)) {
        childrenInsideRenderable.push(childNode);
        return false;
      }
      return true;
    });

    nodeAABB.extend(renderableAABB);

    if (childrenInsideRenderable.length) {
      const newChildNode = new Map2dTreeNode<Renderable>(
        this.tree,
        [renderable],
        childrenInsideRenderable,
      );
      this.children.push(newChildNode);
      // TODO add renderables to newChildNode?
      return;
    }

    this.renderables.push(renderable);

    if (this.renderables.length > 2) {
      const tileCoords = this.tree.tileCoordsUtil.computeTilesWithinCoords(
        nodeAABB.left,
        nodeAABB.top,
        nodeAABB.width,
        nodeAABB.height,
      );
      if (!(tileCoords.rows === 1 && tileCoords.columns === 1)) {
        // TODO split renderables!
        let splitCols = 0;
        if (tileCoords.columns > 1) {
          splitCols = Math.floor(tileCoords.columns / 2);
        }
        let splitRows = 0;
        if (tileCoords.rows > 1) {
          splitRows = Math.floor(tileCoords.rows / 2);
        }
        if (splitCols >= 1 && splitRows >= 1) {
          const splitAABBs = [
            new AABB2(
              nodeAABB.left,
              nodeAABB.top,
              splitCols * tileCoords.tileWidth,
              splitRows * tileCoords.tileHeight,
            ),
            new AABB2(
              nodeAABB.left + splitCols * tileCoords.tileWidth,
              nodeAABB.top,
              (tileCoords.columns - splitCols) * tileCoords.tileWidth,
              splitRows * tileCoords.tileHeight,
            ),
            new AABB2(
              nodeAABB.left,
              nodeAABB.top + splitRows * tileCoords.tileHeight,
              splitCols * tileCoords.tileWidth,
              (tileCoords.rows - splitRows) * tileCoords.tileHeight,
            ),
            new AABB2(
              nodeAABB.left + splitCols * tileCoords.tileWidth,
              nodeAABB.top + splitRows * tileCoords.tileHeight,
              (tileCoords.columns - splitCols) * tileCoords.tileWidth,
              (tileCoords.rows - splitRows) * tileCoords.tileHeight,
            ),
          ];
          console.log('split', splitCols, splitRows, splitAABBs);
        }
      }
    }
  }
}
