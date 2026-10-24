import {describe, expect, it} from 'vitest';
import {
  contentAreaSide,
  getContentAreaSize,
  getHorizontalBorder,
  getHorizontalInnerMargin,
  getHorizontalPadding,
  getVerticalBorder,
  getVerticalInnerMargin,
  getVerticalPadding,
} from './styleUtils.js';

// every side gets a power of two of its own, so any sum that picks up a wrong side lands on a
// value no correct sum can produce
const values: Record<string, string> = {
  'padding-top': '1px',
  'padding-bottom': '2px',
  'padding-left': '4px',
  'padding-right': '8px',
  'border-top-width': '16px',
  'border-bottom-width': '32px',
  'border-left-width': '64px',
  'border-right-width': '128px',
};

const style = {getPropertyValue: (name: string) => values[name] ?? ''} as unknown as CSSStyleDeclaration;

describe('styleUtils', () => {
  it('sums the padding of each axis from its own sides', () => {
    expect(getVerticalPadding(style)).toBe(3);
    expect(getHorizontalPadding(style)).toBe(12);
  });

  it('sums the border of each axis from its own sides', () => {
    expect(getVerticalBorder(style)).toBe(48);
    expect(getHorizontalBorder(style)).toBe(192);
  });

  it('takes the vertical inner margin from top and bottom', () => {
    expect(getVerticalInnerMargin(style)).toBe(51);
  });

  it('takes the horizontal inner margin from left and right', () => {
    expect(getHorizontalInnerMargin(style)).toBe(204);
  });

  it('subtracts the inner margin of each axis from the bounding box of an element without a layout size', () => {
    const fakeElement = {getBoundingClientRect: () => ({width: 1000, height: 500})} as unknown as Element;

    const area = getContentAreaSize(fakeElement, style);

    expect(area.width).toBe(796);
    expect(area.height).toBe(449);
    expect(area.style).toBe(style);
  });

  it('takes the borders and the padding off in the scale a transform gives the element', () => {
    const fakeElement = {
      getBoundingClientRect: () => ({width: 2000, height: 1000}),
      offsetWidth: 1000,
      offsetHeight: 500,
    } as unknown as Element;

    const area = getContentAreaSize(fakeElement, style);

    expect(area.width).toBe(2000 - 2 * 204);
    expect(area.height).toBe(1000 - 2 * 51);
  });

  it('takes them off as the style gives them where the offset size lies within 1 of the client rect', () => {
    const fakeElement = {
      getBoundingClientRect: () => ({width: 1000.4, height: 500.3}),
      offsetWidth: 1000,
      offsetHeight: 500,
    } as unknown as Element;

    const area = getContentAreaSize(fakeElement, style);

    expect(area.width).toBeCloseTo(796.4, 9);
    expect(area.height).toBeCloseTo(449.3, 9);
  });

  it('contentAreaSide() takes the margin off unscaled where there is no layout size above 0', () => {
    for (const layoutSide of [undefined, 0, NaN, -500, '500']) {
      expect(contentAreaSide(2000, layoutSide, 204), String(layoutSide)).toBe(1796);
    }
    expect(contentAreaSide(2000, 1000, 204)).toBe(1592);
  });
});
