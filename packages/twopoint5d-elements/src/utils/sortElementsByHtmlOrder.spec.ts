import {describe, expect, it} from 'vitest';
import {sortElementsByHtmlOrder} from './sortElementsByHtmlOrder.js';

const createElement = (id: string, children: HTMLElement[] = []) => {
  const div = document.createElement('div');
  div.id = id;
  div.append(...children);
  return div;
};

describe('sortElementsByHtmlOrder', () => {
  it('should sort elements by html order', () => {
    const A = createElement('A');
    const B = createElement('B');
    const C = createElement('C');
    const D = createElement('D');
    const E = createElement('E');
    const F = createElement('F');
    const G = createElement('G');
    const H = createElement('H');

    const dAB = createElement('dAB', [A, B]);
    const dFAB = createElement('dFAB', [F, dAB]);
    const dG = createElement('dG', [G]);
    const dCD = createElement('dCD', [C, D]);
    const dCDE = createElement('dCDE', [dCD, E]);

    const ROOT = createElement('ROOT', [dFAB, dG, H, dCDE]);

    const children = sortElementsByHtmlOrder(ROOT, [A, B, C, D, E, F, G, H]);

    expect(children).toHaveLength(8);
    expect(children).toEqual([F, A, B, G, H, C, D, E]);
  });
});
