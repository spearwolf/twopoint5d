export function getVerticalPadding(style: CSSStyleDeclaration): number {
  return parseFloat(style.getPropertyValue('padding-top') || '0') + parseFloat(style.getPropertyValue('padding-bottom') || '0');
}

export function getHorizontalPadding(style: CSSStyleDeclaration): number {
  return parseFloat(style.getPropertyValue('padding-left') || '0') + parseFloat(style.getPropertyValue('padding-right') || '0');
}

export function getVerticalBorder(style: CSSStyleDeclaration): number {
  return (
    parseFloat(style.getPropertyValue('border-top-width') || '0') +
    parseFloat(style.getPropertyValue('border-bottom-width') || '0')
  );
}

export function getHorizontalBorder(style: CSSStyleDeclaration): number {
  return (
    parseFloat(style.getPropertyValue('border-right-width') || '0') +
    parseFloat(style.getPropertyValue('border-left-width') || '0')
  );
}

export function getVerticalInnerMargin(style: CSSStyleDeclaration): number {
  return getVerticalBorder(style) + getVerticalPadding(style);
}

export function getHorizontalInnerMargin(style: CSSStyleDeclaration): number {
  return getHorizontalBorder(style) + getHorizontalPadding(style);
}

/**
 * A side of the content area as `getBoundingClientRect()` measures it: `rectSide` less
 * `innerMargin` — the borders and the padding of that side from the computed style — in the scale
 * the CSS transforms of the element and its ancestors give the element, `rectSide / layoutSide`.
 * `layoutSide` is the same side of the border box without transforms, `offsetWidth` or
 * `offsetHeight`. Where it is no number above 0 — an SVG element has none — or lies within 1 of
 * `rectSide`, which is how far `offsetWidth` and `offsetHeight` round, the margin comes off as the
 * style gives it.
 */
export function contentAreaSide(rectSide: number, layoutSide: unknown, innerMargin: number): number {
  if (typeof layoutSide !== 'number' || !(layoutSide > 0) || Math.abs(rectSide - layoutSide) < 1) {
    return rectSide - innerMargin;
  }
  return rectSide - innerMargin * (rectSide / layoutSide);
}

/**
 * The width and height of the content area of `element` in CSS pixels: its `getBoundingClientRect()`
 * less the borders and the padding of both sides. `style` defaults to `getComputedStyle(element)`, and
 * the answer carries the `style` it used.
 *
 * The borders and the padding come off in the scale the CSS transforms of the element and its
 * ancestors give it: an element under `scale(2)` answers with twice its content box. A rotated
 * element answers with the bounding box `getBoundingClientRect()` gives it, the borders and the
 * padding in the ratio of that box to its layout size; an element without `offsetWidth` — an SVG
 * element — with the borders and the padding as the style gives them.
 */
export function getContentAreaSize(
  element: Element,
  style?: CSSStyleDeclaration,
): {width: number; height: number; style: CSSStyleDeclaration} {
  style ??= getComputedStyle(element, null);

  const elementSize = element.getBoundingClientRect();

  const horizontalInnerMargin = getHorizontalInnerMargin(style);
  const verticalInnerMargin = getVerticalInnerMargin(style);

  return {
    style,
    // duck-typed rather than instanceof HTMLElement: an element of a same-origin iframe has an
    // HTMLElement of its own
    width: contentAreaSide(elementSize.width, (element as HTMLElement).offsetWidth, horizontalInnerMargin),
    height: contentAreaSide(elementSize.height, (element as HTMLElement).offsetHeight, verticalInnerMargin),
  };
}

export function getIsContentBox(style: CSSStyleDeclaration): boolean {
  return style.getPropertyValue('box-sizing') === 'content-box';
}
