import {expect} from '@esm-bundle/chai';
import {Stylesheets} from '@spearwolf/twopoint5d';

/** The module state travels from case to case, so every case works under a name of its own. */
function uniqueName(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function ruleCount() {
  return Stylesheets.getGlobalSheet().cssRules.length;
}

function findRule(className) {
  const selector = `.${className}`;
  return Array.from(Stylesheets.getGlobalSheet().cssRules).find((rule) => rule.selectorText === selector);
}

describe('Stylesheets', function () {
  it('installs one rule per name, whatever the css', () => {
    const name = uniqueName('one-rule-per-name');
    const before = ruleCount();

    Stylesheets.installRule(name, 'cursor: pointer;');
    Stylesheets.installRule(name, 'cursor: crosshair;');

    expect(ruleCount() - before, 'rules added to the global sheet').to.equal(1);
  });

  it('the second call wins', () => {
    const name = uniqueName('second-call-wins');

    Stylesheets.installRule(name, 'cursor: pointer;');
    const className = Stylesheets.installRule(name, 'cursor: crosshair;');

    // the raw cssText is normalized by the browser, so the check goes through a property
    expect(findRule(className)?.style.cursor, 'the cursor the sheet carries').to.equal('crosshair');
  });

  it('an unchanged css installs nothing', () => {
    const name = uniqueName('unchanged-css');
    const before = ruleCount();

    Stylesheets.installRule(name, 'cursor: pointer;');
    Stylesheets.installRule(name, 'cursor: pointer;');

    expect(ruleCount() - before, 'rules added to the global sheet').to.equal(1);
  });
});
