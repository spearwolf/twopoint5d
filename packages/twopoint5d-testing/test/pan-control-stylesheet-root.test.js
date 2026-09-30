import {expect} from '@esm-bundle/chai';
import {PanControl2D, Stylesheets} from '@spearwolf/twopoint5d';

// the rules of the cursor style `cursor` in the stylesheet of `root`: the class name
// carries a postfix, so a rule is known by its prefix and by the cursor it carries — a
// rule of another cursor that an earlier test left behind is not one of them
function cursorRules(root, cursor) {
  return /** @type {CSSStyleRule[]} */ (Array.from(Stylesheets.getSheet(root).cssRules)).filter(
    (rule) => rule.selectorText?.startsWith('.PanControl2D-') && rule.style.cursor === cursor,
  );
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

    expect(cursorRules(shadowRoot, 'grabbing').length, 'grabbing rules inside the shadow root').to.equal(1);
  });

  it('puts the rule in the stylesheet of the document when no root is named', () => {
    const shadowRoot = host.attachShadow({mode: 'open'});

    expect(
      cursorRules(undefined, 'crosshair').length,
      'crosshair rules in the stylesheet of the document before the control',
    ).to.equal(0);

    control = new PanControl2D({cursorPanStyle: 'crosshair'});

    expect(
      cursorRules(undefined, 'crosshair').length,
      'crosshair rules in the stylesheet of the document after the control',
    ).to.equal(1);
    expect(cursorRules(shadowRoot, 'crosshair').length, 'crosshair rules inside the untouched shadow root').to.equal(0);
  });
});
