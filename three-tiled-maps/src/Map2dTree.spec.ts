import {AABB2} from './AABB2';
import {IMap2dRenderable} from './IMap2dRenderable';
import {Map2dTree} from './Map2dTree';
import {Map2dTreeNode} from './Map2dTreeNode';

type RenderableWithName = IMap2dRenderable & {
  name: string;
};

const aabbToArray = (aabb: AABB2) => [aabb.left, aabb.top, aabb.width, aabb.height];

const nodeToJSON = (node: Map2dTreeNode<RenderableWithName>): any => {
  return {
    aabb: [node.aabb.left, node.aabb.top, node.aabb.width, node.aabb.height],
    renderables: node.renderables
      .map((renderable) => ({
        name: renderable.name,
        aabb: aabbToArray(renderable.aabb),
      }))
      .sort(
        (a, b) => a.name.localeCompare(b.name) || a.aabb[0] - b.aabb[0] || a.aabb[1] - b.aabb[1],
      ),
    children: node.children
      .map((child) => nodeToJSON(child))
      .sort((a, b) => a.aabb[0] - b.aabb[0] || a.aabb[1] - b.aabb[1]),
  };
};

describe('Map2dTree', () => {
  it('construct', () => {
    const tree = new Map2dTree(10, 20);
    expect(tree).toBeDefined();
    expect(tree.tileCoordsUtil.tileWidth).toBe(10);
    expect(tree.tileCoordsUtil.tileHeight).toBe(20);
  });

  describe('add', () => {
    it('first renderable in tree', () => {
      const tree = new Map2dTree(10, 10);
      const renderable: IMap2dRenderable = {aabb: new AABB2(25, 25, 30, 30)};
      tree.add(renderable);
      expect(tree.rootNode.renderables).toEqual([renderable]);
    });

    it('add two non-overlapping renderables', () => {
      const tree = new Map2dTree<RenderableWithName>(10, 10);
      const renderables: Array<RenderableWithName> = [
        {name: 'A', aabb: new AABB2(25, 25, 30, 30)},
        {name: 'B', aabb: new AABB2(0, 0, 10, 10)},
      ];
      tree.add(...renderables);
      expect(nodeToJSON(tree.rootNode)).toMatchObject({
        aabb: [0, 0, 60, 60],
        renderables: [
          {
            name: 'A',
            aabb: [25, 25, 30, 30],
          },
          {
            name: 'B',
            aabb: [0, 0, 10, 10],
          },
        ],
        children: [],
      });
    });

    it('add two equal-sized renderables', () => {
      const tree = new Map2dTree<RenderableWithName>(10, 10);
      const renderables: Array<RenderableWithName> = [
        {name: 'A', aabb: new AABB2(25, 25, 30, 30)},
        {name: 'B', aabb: new AABB2(26, 22, 31, 34)},
      ];
      tree.add(...renderables);
      expect(nodeToJSON(tree.rootNode)).toMatchObject({
        aabb: [20, 20, 40, 40],
        renderables: [
          {
            name: 'A',
            aabb: [25, 25, 30, 30],
          },
          {
            name: 'B',
            aabb: [26, 22, 31, 34],
          },
        ],
        children: [],
      });
    });

    it('the new renderable contains the entire node', () => {
      const tree = new Map2dTree<RenderableWithName>(10, 10);
      const renderables: Array<RenderableWithName> = [
        {name: 'A', aabb: new AABB2(25, 25, 30, 30)},
        {name: 'B', aabb: new AABB2(0, 0, 100, 100)},
      ];
      tree.add(...renderables);
      expect(nodeToJSON(tree.rootNode)).toMatchObject({
        aabb: [0, 0, 100, 100],
        renderables: [
          {
            name: 'B',
            aabb: [0, 0, 100, 100],
          },
        ],
        children: [
          {
            aabb: [20, 20, 40, 40],
            renderables: [
              {
                name: 'A',
                aabb: [25, 25, 30, 30],
              },
            ],
            children: [],
          },
        ],
      });
    });

    it('the new renderable is inside a child node', () => {
      const tree = new Map2dTree<RenderableWithName>(10, 10);
      const renderables: Array<RenderableWithName> = [
        {name: 'A', aabb: new AABB2(25, 25, 30, 30)},
        {name: 'B', aabb: new AABB2(0, 0, 100, 100)},
        {name: 'C', aabb: new AABB2(30, 30, 10, 10)},
      ];
      tree.add(...renderables);
      // console.log(JSON.stringify(nodeToJSON(tree.rootNode), null, 2));
      expect(nodeToJSON(tree.rootNode)).toMatchObject({
        aabb: [0, 0, 100, 100],
        renderables: [
          {
            name: 'B',
            aabb: [0, 0, 100, 100],
          },
        ],
        children: [
          {
            aabb: [20, 20, 40, 40],
            renderables: [
              {
                name: 'A',
                aabb: [25, 25, 30, 30],
              },
              {
                name: 'C',
                aabb: [30, 30, 10, 10],
              },
            ],
            children: [],
          },
        ],
      });
    });

    it('grid of equal-sized leaf-tile-sized renderables', () => {
      const tree = new Map2dTree<RenderableWithName>(10, 10);
      const renderables: Array<RenderableWithName> = [
        {name: 'A', aabb: new AABB2(0, 0, 10, 10)},
        {name: 'B', aabb: new AABB2(10, 0, 10, 10)},
        {name: 'C', aabb: new AABB2(0, 10, 10, 10)},
        {name: 'D', aabb: new AABB2(10, 10, 10, 10)},
      ];
      tree.add(...renderables);
      // console.log(JSON.stringify(nodeToJSON(tree.rootNode), null, 2));
      expect(nodeToJSON(tree.rootNode)).toMatchObject({
        aabb: [0, 0, 20, 20],
        renderables: [
          {
            name: 'A',
            aabb: [0, 0, 10, 10],
          },
          {
            name: 'B',
            aabb: [10, 0, 10, 10],
          },
          {
            name: 'C',
            aabb: [0, 10, 10, 10],
          },
          {
            name: 'D',
            aabb: [10, 10, 10, 10],
          },
        ],
        children: [],
      });
    });
  });
});
