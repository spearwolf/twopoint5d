import {Vector2} from 'three';

import {fitIntoRectangle} from './fitIntoRectangle';

describe('fitIntoRectangle', () => {
  it('pixelZoom', () => {
    const target = new Vector2();
    expect(fitIntoRectangle(new Vector2(640, 400), {pixelZoom: 2}, target)).toBe(target);
    expect(target.width).toBe(320);
    expect(target.height).toBe(200);
  });
  it('fill', () => {
    const target = new Vector2();
    expect(fitIntoRectangle(new Vector2(640, 400), {fit: 'fill'}, target)).toBe(target);
    expect(target.width).toBe(640);
    expect(target.height).toBe(400);
  });
  it('contain & width', () => {
    const target = new Vector2();
    expect(fitIntoRectangle(new Vector2(640, 400), {fit: 'contain', width: 400}, target)).toBe(target);
    expect(target.width).toBe(400);
    expect(target.height).toBe(250);
  });
  it('contain & width & minPixelZoom', () => {
    const target = new Vector2();
    expect(fitIntoRectangle(new Vector2(640, 400), {fit: 'contain', width: 400, minPixelZoom: 2}, target)).toBe(target);
    expect(target.width).toBe(320);
    expect(target.height).toBe(200);
    expect(
      fitIntoRectangle(new Vector2(640, 400), {
        fit: 'contain',
        width: 400,
        minPixelZoom: 1,
      }).toArray(),
    ).toEqual([400, 250]);
  });
  it('contain & width & maxPixelZoom', () => {
    const target = new Vector2();
    expect(fitIntoRectangle(new Vector2(640, 400), {fit: 'contain', width: 100, maxPixelZoom: 7}, target)).toBe(target);
    expect(target.width).toBe(100);
    expect(target.height).toBe(62.5);
    expect(
      fitIntoRectangle(new Vector2(640, 400), {
        fit: 'contain',
        width: 100,
        maxPixelZoom: 2,
      }).toArray(),
    ).toEqual([320, 200]);
  });
  it('contain & height', () => {
    const target = new Vector2();
    expect(fitIntoRectangle(new Vector2(640, 400), {fit: 'contain', height: 100}, target)).toBe(target);
    expect(target.width).toBe(160);
    expect(target.height).toBe(100);
  });
});
