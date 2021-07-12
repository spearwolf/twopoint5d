import {IMap2dRenderable} from './IMap2dRenderable';
import {Map2dTileCoordsUtil} from './Map2dTileCoordsUtil';
import {Map2dTreeNode} from './Map2dTreeNode';

export class Map2dTree<Renderable extends IMap2dRenderable> {
  rootNode: Map2dTreeNode<Renderable>;
  tileCoordsUtil: Map2dTileCoordsUtil;

  constructor(tileWidth = 0, tileHeight = 0, xOffset = 0, yOffset = 0) {
    this.tileCoordsUtil = new Map2dTileCoordsUtil(tileWidth, tileHeight, xOffset, yOffset);
    this.rootNode = new Map2dTreeNode(this);
  }

  add(...renderables: Array<Renderable>) {
    for (const renderable of renderables) {
      this.rootNode.add(renderable);
    }
    return this;
  }
}
