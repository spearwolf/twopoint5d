import {expect} from '@esm-bundle/chai';
import {PanControl2D, Stylesheets} from '@spearwolf/twopoint5d';

// the control installs its cursor rule under a name shared by the whole module; the class name
// carries a postfix, so the rule is found by the prefix rather than by a literal selector
function findCursorRule(root) {
  return Array.from(Stylesheets.getGlobalSheet(root).cssRules).find((rule) => rule.selectorText?.startsWith('.PanControl2D-'));
}

describe('PanControl2D — the root its cursor rule lands in', () => {
  /** @type {HTMLElement} */
  let host;
  /** @type {PanControl2D | undefined} */
  let control;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    control?.dispose();
    control = undefined;
    host.remove();
  });

  it('installs the cursor rule in the root it was given', () => {
    const shadowRoot = host.attachShadow({mode: 'open'});
    const cursorStylesTarget = document.createElement('div');
    shadowRoot.appendChild(cursorStylesTarget);

    control = new PanControl2D({cursorStylesTarget, cursorPanStyle: 'grabbing', styleSheetRoot: shadowRoot});

    const rule = findCursorRule(shadowRoot);

    expect(rule, 'the cursor rule inside the shadow root').to.exist;
    expect(rule?.style.cursor, 'the cursor the rule carries').to.equal('grabbing');
  });

  it('leaves the rule in document.head when no root is named', () => {
    const shadowRoot = host.attachShadow({mode: 'open'});

    control = new PanControl2D({cursorPanStyle: 'crosshair'});

    expect(findCursorRule(), 'the cursor rule in document.head').to.exist;
    expect(findCursorRule(shadowRoot), 'a cursor rule inside the untouched shadow root').to.not.exist;
  });
});
