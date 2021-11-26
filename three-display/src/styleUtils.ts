export function getVerticalPadding(style: CSSStyleDeclaration): number {
  return (
    parseInt(style.getPropertyValue('padding-top') || '0', 10) + parseInt(style.getPropertyValue('padding-bottom') || '0', 10)
  );
}

export function getHorizontalPadding(style: CSSStyleDeclaration): number {
  return (
    parseInt(style.getPropertyValue('padding-left') || '0', 10) + parseInt(style.getPropertyValue('padding-right') || '0', 10)
  );
}

export function getVerticalBorder(style: CSSStyleDeclaration): number {
  return (
    parseInt(style.getPropertyValue('border-top-width') || '0', 10) +
    parseInt(style.getPropertyValue('border-bottom-width') || '0', 10)
  );
}

export function getHorizontalBorder(style: CSSStyleDeclaration): number {
  return (
    parseInt(style.getPropertyValue('border-right-width') || '0', 10) +
    parseInt(style.getPropertyValue('border-left-width') || '0', 10)
  );
}

export function getVerticalInnerMargin(style: CSSStyleDeclaration): number {
  return getVerticalBorder(style) + getVerticalPadding(style);
}

export function getHorizontalInnerMargin(style: CSSStyleDeclaration): number {
  return getVerticalBorder(style) + getHorizontalPadding(style);
}

export function getVerticalMargin(style: CSSStyleDeclaration): number {
  return parseInt(style.getPropertyValue('margin-top') || '0', 10) + parseInt(style.getPropertyValue('margin-bottom') || '0', 10);
}

export function getHorizontalMargin(style: CSSStyleDeclaration): number {
  return parseInt(style.getPropertyValue('margin-left') || '0', 10) + parseInt(style.getPropertyValue('margin-right') || '0', 10);
}

export function getIsContentBox(style: CSSStyleDeclaration): boolean {
  return style.getPropertyValue('box-sizing') === 'content-box';
}
