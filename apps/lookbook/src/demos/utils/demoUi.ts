/**
 * The `<demo-ui>` of a page that uses `VanillaDemo.astro`: the layer over the canvas and the
 * navbar blur, under the logo and the title. A demo hands it to whatever builds its HTML at
 * runtime, `new GUI({container: getDemoUi()})` for a lil-gui panel.
 */
export function getDemoUi(): HTMLElement {
  const demoUi = document.querySelector<HTMLElement>('demo-ui');
  if (!demoUi) {
    throw new Error('[lookbook] getDemoUi(): the page has no <demo-ui> element, write one into the markup of the page');
  }
  return demoUi;
}
