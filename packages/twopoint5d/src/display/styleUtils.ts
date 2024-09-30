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
  return getVerticalBorder(style) + getHorizontalPadding(style);
}

export function getContentAreaSize(
  element: HTMLElement,
  style?: CSSStyleDeclaration,
): {width: number; height: number; style: CSSStyleDeclaration} {
  style ??= getComputedStyle(element, null);

  const elementSize = element.getBoundingClientRect();

  const horizontalInnerMargin = getHorizontalInnerMargin(style);
  const verticalInnerMargin = getVerticalInnerMargin(style);

  return {
    style,
    width: elementSize.width - horizontalInnerMargin,
    height: elementSize.height - verticalInnerMargin,
  };
}

export function getIsContentBox(style: CSSStyleDeclaration): boolean {
  return style.getPropertyValue('box-sizing') === 'content-box';
}
