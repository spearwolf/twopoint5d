import {Map2dSpatialHashGrid} from './Map2dSpatialHashGrid';

describe('Map2dSpatialHashGrid', () => {
  test('construction', () => {
    const grid = new Map2dSpatialHashGrid(10, 100, -5, -50);
    expect(grid).toBeDefined();
  });
});
