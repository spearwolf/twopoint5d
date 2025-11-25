import {Vector2} from 'three/webgpu';
import {describe, expect, it} from 'vitest';

import {calculateAnchorOffset, fitIntoRectangle, parseAnchorPosition} from './fitIntoRectangle.js';

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

describe('parseAnchorPosition', () => {
  it('should return center center for undefined', () => {
    expect(parseAnchorPosition(undefined)).toEqual(['center', 'center']);
  });

  it('should return center center for "center"', () => {
    expect(parseAnchorPosition('center')).toEqual(['center', 'center']);
  });

  it('should parse "top left"', () => {
    expect(parseAnchorPosition('top left')).toEqual(['top', 'left']);
  });

  it('should parse "top center"', () => {
    expect(parseAnchorPosition('top center')).toEqual(['top', 'center']);
  });

  it('should parse "top right"', () => {
    expect(parseAnchorPosition('top right')).toEqual(['top', 'right']);
  });

  it('should parse "center left"', () => {
    expect(parseAnchorPosition('center left')).toEqual(['center', 'left']);
  });

  it('should parse "center center"', () => {
    expect(parseAnchorPosition('center center')).toEqual(['center', 'center']);
  });

  it('should parse "center right"', () => {
    expect(parseAnchorPosition('center right')).toEqual(['center', 'right']);
  });

  it('should parse "bottom left"', () => {
    expect(parseAnchorPosition('bottom left')).toEqual(['bottom', 'left']);
  });

  it('should parse "bottom center"', () => {
    expect(parseAnchorPosition('bottom center')).toEqual(['bottom', 'center']);
  });

  it('should parse "bottom right"', () => {
    expect(parseAnchorPosition('bottom right')).toEqual(['bottom', 'right']);
  });
});

describe('calculateAnchorOffset', () => {
  // Container is 800x600, view is 640x480
  // diffX = 160, diffY = 120
  const rect = new Vector2(800, 600);
  const view = new Vector2(640, 480);

  it('should return (80, 60) for center (default)', () => {
    const offset = calculateAnchorOffset(rect, view);
    expect(offset.x).toBe(80);
    expect(offset.y).toBe(60);
  });

  it('should return (80, 60) for "center"', () => {
    const offset = calculateAnchorOffset(rect, view, 'center');
    expect(offset.x).toBe(80);
    expect(offset.y).toBe(60);
  });

  it('should return (0, 0) for "top left"', () => {
    const offset = calculateAnchorOffset(rect, view, 'top left');
    expect(offset.x).toBe(0);
    expect(offset.y).toBe(0);
  });

  it('should return (80, 0) for "top center"', () => {
    const offset = calculateAnchorOffset(rect, view, 'top center');
    expect(offset.x).toBe(80);
    expect(offset.y).toBe(0);
  });

  it('should return (160, 0) for "top right"', () => {
    const offset = calculateAnchorOffset(rect, view, 'top right');
    expect(offset.x).toBe(160);
    expect(offset.y).toBe(0);
  });

  it('should return (0, 60) for "center left"', () => {
    const offset = calculateAnchorOffset(rect, view, 'center left');
    expect(offset.x).toBe(0);
    expect(offset.y).toBe(60);
  });

  it('should return (80, 60) for "center center"', () => {
    const offset = calculateAnchorOffset(rect, view, 'center center');
    expect(offset.x).toBe(80);
    expect(offset.y).toBe(60);
  });

  it('should return (160, 60) for "center right"', () => {
    const offset = calculateAnchorOffset(rect, view, 'center right');
    expect(offset.x).toBe(160);
    expect(offset.y).toBe(60);
  });

  it('should return (0, 120) for "bottom left"', () => {
    const offset = calculateAnchorOffset(rect, view, 'bottom left');
    expect(offset.x).toBe(0);
    expect(offset.y).toBe(120);
  });

  it('should return (80, 120) for "bottom center"', () => {
    const offset = calculateAnchorOffset(rect, view, 'bottom center');
    expect(offset.x).toBe(80);
    expect(offset.y).toBe(120);
  });

  it('should return (160, 120) for "bottom right"', () => {
    const offset = calculateAnchorOffset(rect, view, 'bottom right');
    expect(offset.x).toBe(160);
    expect(offset.y).toBe(120);
  });

  it('should use provided target Vector2', () => {
    const target = new Vector2();
    const result = calculateAnchorOffset(rect, view, 'top left', target);
    expect(result).toBe(target);
    expect(target.x).toBe(0);
    expect(target.y).toBe(0);
  });

  it('should handle negative differences (cover mode)', () => {
    // View is larger than container
    const largerView = new Vector2(1000, 800);
    const offset = calculateAnchorOffset(rect, largerView, 'center');
    expect(offset.x).toBe(-100);
    expect(offset.y).toBe(-100);
  });
});
