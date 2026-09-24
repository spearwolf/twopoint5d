import {expect} from '@esm-bundle/chai';
import {Stylesheets} from '@spearwolf/twopoint5d';

/** The module state travels from case to case, so every case works under a name of its own. */
function uniqueName(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function ruleCount(root) {
  return Stylesheets.getSheet(root).cssRules.length;
}

function findRule(className, root) {
  const selector = `.${className}`;
  return /** @type {CSSStyleRule[]} */ (Array.from(Stylesheets.getSheet(root).cssRules)).find(
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

  /** The document of a fresh iframe in `document.body`: a document of another realm. */
  function makeIframeDocument() {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    hosts.push(iframe);
    return /** @type {Document} */ (iframe.contentDocument);
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

    expect(Stylesheets.getSheet(rootA), 'the sheet of the first shadow root').to.not.equal(Stylesheets.getSheet(rootB));
    expect(Stylesheets.getSheet(rootA), 'the sheet of the first shadow root').to.not.equal(Stylesheets.getSheet());

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
    expect(untouchedRoot.adoptedStyleSheets.length, 'the sheets of a root nothing was written to').to.equal(0);

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

  it('installs a rule in a shadow root whose host is not in the document yet', () => {
    // a web component that builds its shadow tree in its constructor, before it is connected
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({mode: 'open'});
    const name = uniqueName('detached-host');

    /** @type {string | undefined} */
    let className;
    expect(() => {
      className = Stylesheets.installRule(name, 'cursor: pointer;', shadowRoot);
    }, 'installRule() in a shadow root of a detached host').to.not.throw();

    const div = document.createElement('div');
    div.classList.add(className);
    shadowRoot.appendChild(div);
    document.body.appendChild(host);
    hosts.push(host);

    expect(getComputedStyle(div).cursor, 'the cursor once the host is in the document').to.equal('pointer');
  });

  it('keeps its rules when the shadow host moves to another place in the document', () => {
    const shadowRoot = makeShadowRoot();
    const host = /** @type {HTMLElement} */ (shadowRoot.host);
    const className = Stylesheets.installRule(uniqueName('moved-host'), 'cursor: pointer;', shadowRoot);
    const div = document.createElement('div');
    div.classList.add(className);
    shadowRoot.appendChild(div);

    const other = document.createElement('div');
    document.body.appendChild(other);
    hosts.push(other);
    other.appendChild(host);

    expect(getComputedStyle(div).cursor, 'the cursor after the host has moved').to.equal('pointer');
  });

  it('puts a rule installed after the shadow host moved where its elements see it', () => {
    const shadowRoot = makeShadowRoot();
    const host = /** @type {HTMLElement} */ (shadowRoot.host);
    // the sheet of the root exists before the move
    Stylesheets.installRule(uniqueName('before-move'), 'cursor: crosshair;', shadowRoot);

    const other = document.createElement('div');
    document.body.appendChild(other);
    hosts.push(other);
    other.appendChild(host);

    const className = Stylesheets.installRule(uniqueName('after-move'), 'cursor: pointer;', shadowRoot);
    const div = document.createElement('div');
    div.classList.add(className);
    shadowRoot.appendChild(div);

    expect(getComputedStyle(div).cursor, 'the cursor of a rule installed after the move').to.equal('pointer');
  });

  it('an element stands for the document or shadow root it sits in', () => {
    const shadowRoot = makeShadowRoot();
    const elementInShadowRoot = document.createElement('div');
    shadowRoot.appendChild(elementInShadowRoot);

    // compared by identity: a failed comparison of two sheets has the whole DOM to print
    expect(
      Stylesheets.getSheet(elementInShadowRoot) === Stylesheets.getSheet(shadowRoot),
      'an element in a shadow root has the sheet of that root',
    ).to.equal(true);
    expect(
      Stylesheets.getSheet(document.body) === Stylesheets.getSheet(),
      'document.body has the sheet of the document',
    ).to.equal(true);
    expect(
      shadowRoot.adoptedStyleSheets.includes(Stylesheets.getSheet(shadowRoot)),
      'the shadow root has adopted its sheet',
    ).to.equal(true);
    expect(document.adoptedStyleSheets.includes(Stylesheets.getSheet()), 'the document has adopted its sheet').to.equal(true);
  });

  it('escapes the class name in the selector of its rule', () => {
    const root = makeShadowRoot();
    const div = document.createElement('div');
    root.appendChild(div);

    // unescaped, the name turns the selector into a list that matches every div in the root
    Stylesheets.installRule(`${uniqueName('x')}, div, y`, 'cursor: wait;', root);

    expect(getComputedStyle(div).cursor, 'the cursor of a div without the class').to.not.equal('wait');
  });

  it('adopts its sheet again into a root whose adoptedStyleSheets were replaced', () => {
    const shadowRoot = makeShadowRoot();
    const classNameA = Stylesheets.installRule(uniqueName('adopted-a'), 'cursor: pointer;', shadowRoot);
    const div = document.createElement('div');
    div.classList.add(classNameA);
    shadowRoot.appendChild(div);

    // a framework that manages the sheets of the root writes its own list
    shadowRoot.adoptedStyleSheets = [];
    Stylesheets.installRule(uniqueName('adopted-b'), 'cursor: crosshair;', shadowRoot);

    expect(
      shadowRoot.adoptedStyleSheets.includes(Stylesheets.getSheet(shadowRoot)),
      'the shadow root has adopted its sheet again',
    ).to.equal(true);
    expect(getComputedStyle(div).cursor, 'the cursor of the first rule').to.equal('pointer');
  });

  it('installs a rule in the document of an iframe', () => {
    const iframeDocument = makeIframeDocument();
    const div = iframeDocument.createElement('div');
    iframeDocument.body.appendChild(div);

    /** @type {string | undefined} */
    let className;
    expect(() => {
      className = Stylesheets.installRule(uniqueName('iframe-document'), 'cursor: pointer;', iframeDocument.head);
    }, 'installRule() in the document of an iframe').to.not.throw();
    div.classList.add(className);

    expect(iframeDocument.defaultView.getComputedStyle(div).cursor, 'the cursor in the iframe').to.equal('pointer');
  });

  it('installs a rule in a shadow root inside an iframe', () => {
    const iframeDocument = makeIframeDocument();
    const host = iframeDocument.createElement('div');
    iframeDocument.body.appendChild(host);
    const shadowRoot = host.attachShadow({mode: 'open'});
    const div = iframeDocument.createElement('div');
    shadowRoot.appendChild(div);

    /** @type {string | undefined} */
    let className;
    expect(() => {
      className = Stylesheets.installRule(uniqueName('iframe-shadow-root'), 'cursor: pointer;', shadowRoot);
    }, 'installRule() in a shadow root inside an iframe').to.not.throw();
    div.classList.add(className);

    expect(iframeDocument.defaultView.getComputedStyle(div).cursor, 'the cursor in the shadow root').to.equal('pointer');
  });

  it('getGlobalSheet() answers the sheet getSheet() answers for the same root', () => {
    const shadowRoot = makeShadowRoot();

    expect(Stylesheets.getGlobalSheet(), 'the document').to.equal(Stylesheets.getSheet());
    expect(Stylesheets.getGlobalSheet(shadowRoot), 'a shadow root').to.equal(Stylesheets.getSheet(shadowRoot));
  });

  it('refuses a root in a document without a window, on every call, with a message that says so', () => {
    const doc = document.implementation.createHTMLDocument('');
    const el = doc.createElement('div');
    doc.body.appendChild(el);

    for (const call of ['the first call', 'the second call']) {
      expect(() => Stylesheets.installRule('twopoint5d-test-windowless', 'color: red', el), call).to.throw(
        Error,
        'without a window',
      );
    }
    expect(() => Stylesheets.releaseRule('twopoint5d-test-windowless', el), 'releaseRule()').to.not.throw();
  });
});
