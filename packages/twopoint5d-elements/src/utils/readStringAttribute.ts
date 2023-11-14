export function readStringAttribute(el: HTMLElement, name: string, validValues?: string[], defValue = ''): string {
  if (el.hasAttribute(name)) {
    const strVal = el.getAttribute(name).trim().toLowerCase();
    if (validValues == null || validValues.includes(strVal)) {
      return strVal;
    } else {
      console.warn(`invalid value for "${name}":`, strVal, 'valid values:', validValues, 'defaulting to:', defValue);
    }
  }
  return defValue;
}
