import {Map2DTile} from './Map2DTile.js';

describe('Map2DTile', () => {
  test('id', () => {
    const tile = new Map2DTile(0, 0);
    expect(tile.id).toBe('y0x0');
  });
  test('x, y', () => {
    const tile = new Map2DTile(8, 16);
    expect(tile.x).toBe(8);
    expect(tile.y).toBe(16);
  });
  test('view', () => {
    const tile = new Map2DTile(8, 16);
    expect(tile.view).toMatchObject({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    });
  });
});
