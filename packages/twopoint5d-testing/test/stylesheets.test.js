import {expect} from '@esm-bundle/chai';
import {Stylesheets} from '@spearwolf/twopoint5d';

/** The module state travels from case to case, so every case works under a name of its own. */
function uniqueName(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function ruleCount(root) {
  return Stylesheets.getGlobalSheet(root).cssRules.length;
}

function findRule(className, root) {
  const selector = `.${className}`;
  return /** @type {CSSStyleRule[]} */ (Array.from(Stylesheets.getGlobalSheet(root).cssRules)).find(
    (rule) => rule.selectorText === selector,
  );
}

describe('Stylesheets', function () {
  /** @type {HTMLElement[]} */
  let hosts = [];

  function makeShadowRoot() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    hosts.push(host);
    return host.attachShadow({mode: 'open'});
  }

  afterEach(() => {
    for (const host of hosts) {
      host.remove();
    }
    hosts = [];
  });

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

  it('installs its rule in the root it was given', () => {
    const rootA = makeShadowRoot();
    const rootB = makeShadowRoot();

    const name = uniqueName('per-root');
    const classNameA = Stylesheets.installRule(name, 'cursor: pointer;', rootA);
    const classNameB = Stylesheets.installRule(name, 'cursor: pointer;', rootB);

    expect(Stylesheets.getGlobalSheet(rootA), 'the sheet of the first shadow root').to.not.equal(
      Stylesheets.getGlobalSheet(rootB),
    );
    expect(Stylesheets.getGlobalSheet(rootA), 'the sheet of the first shadow root').to.not.equal(Stylesheets.getGlobalSheet());

    expect(findRule(classNameA, rootA), 'the rule inside the first shadow root').to.exist;
    expect(findRule(classNameB, rootB), 'the rule inside the second shadow root').to.exist;
  });

  it('a rule retained twice stays until it is released twice', () => {
    const root = makeShadowRoot();
    const name = uniqueName('retained-twice');

    const className = Stylesheets.retainRule(name, 'cursor: pointer;', root);
    Stylesheets.retainRule(name, 'cursor: pointer;', root);

    Stylesheets.releaseRule(name, root);

    expect(findRule(className, root), 'the rule after the first release').to.exist;

    Stylesheets.releaseRule(name, root);

    expect(findRule(className, root), 'the rule after the second release').to.not.exist;
    expect(ruleCount(root), 'rules in the sheet').to.equal(0);
  });

  it('releasing a rule leaves the rules after it in place', () => {
    const root = makeShadowRoot();
    const nameA = uniqueName('release-first');
    const nameB = uniqueName('release-second');

    Stylesheets.retainRule(nameA, 'cursor: pointer;', root);
    const classNameB = Stylesheets.retainRule(nameB, 'cursor: crosshair;', root);

    Stylesheets.releaseRule(nameA, root);

    expect(ruleCount(root), 'rules in the sheet').to.equal(1);
    expect(findRule(classNameB, root)?.style.cursor, 'the cursor of the rule that stayed').to.equal('crosshair');
  });

  it('a rule installRule put there stays after its last release', () => {
    const root = makeShadowRoot();
    const name = uniqueName('pinned');

    const className = Stylesheets.installRule(name, 'cursor: pointer;', root);
    Stylesheets.retainRule(name, 'cursor: pointer;', root);
    Stylesheets.releaseRule(name, root);

    expect(findRule(className, root), 'the rule after the release').to.exist;
    expect(ruleCount(root), 'rules in the sheet').to.equal(1);
  });

  it('a release without a retain changes nothing', () => {
    const untouchedRoot = makeShadowRoot();

    expect(
      () => Stylesheets.releaseRule(uniqueName('never-retained'), untouchedRoot),
      'a release in a root without a sheet',
    ).to.not.throw();
    expect(untouchedRoot.querySelector('style'), 'the sheet of a root nothing was written to').to.equal(null);

    const root = makeShadowRoot();
    const name = uniqueName('released-too-often');

    Stylesheets.retainRule(name, 'cursor: pointer;', root);
    Stylesheets.releaseRule(name, root);

    expect(() => Stylesheets.releaseRule(name, root), 'the second release').to.not.throw();
    expect(ruleCount(root), 'rules in the sheet').to.equal(0);
  });

  it('a retain with a different css rewrites the rule', () => {
    const root = makeShadowRoot();
    const name = uniqueName('retain-rewrites');

    Stylesheets.retainRule(name, 'cursor: pointer;', root);
    const className = Stylesheets.retainRule(name, 'cursor: crosshair;', root);

    expect(ruleCount(root), 'rules in the sheet').to.equal(1);
    expect(findRule(className, root)?.style.cursor, 'the cursor the sheet carries').to.equal('crosshair');
  });

  it('retainRule returns the class name installRule returns for the name', () => {
    const name = uniqueName('same-class-name');

    const retained = Stylesheets.retainRule(name, 'cursor: pointer;');
    const installed = Stylesheets.installRule(name, 'cursor: pointer;');

    expect(retained).to.equal(installed);
  });
});
