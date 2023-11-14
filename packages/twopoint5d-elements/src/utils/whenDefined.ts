export async function whenDefined<T extends Element>(el: T): Promise<T> {
  if (el == null) {
    throw new Error('el is null');
  }
  if (!((el as any) instanceof HTMLElement)) {
    throw new Error('el is not an HTMLElement');
  }
  await customElements.whenDefined(el.tagName.toLowerCase());
  return el;
}
