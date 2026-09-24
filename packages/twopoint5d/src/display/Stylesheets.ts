const postFixID = Math.round(Math.random() * (1 << 24)).toString(16);

// One sheet per document or shadow root: a rule installed for a shadow root has to land in that
// root, or the elements inside it never see it.
const sheets = new WeakMap<Document | ShadowRoot, CSSStyleSheet>();

// The document or shadow root whose adoptedStyleSheets carry the rules for `root`. An element
// stands for the root node it sits in, because a rule reaches the elements of exactly that root —
// also a shadow root whose host is not in the document yet. An element that sits in neither falls
// on its document: that is the default of this module, and whoever wants a shadow root names it.
// The check goes by property, not by instanceof, so a root from another realm passes as well —
// the sheet for it comes from that realm, see newSheetFor()
function scopeOf(root: HTMLElement | ShadowRoot): Document | ShadowRoot {
  const node = root.getRootNode();
  if ('adoptedStyleSheets' in node) {
    return node as Document | ShadowRoot;
  }
  return root.ownerDocument;
}

// A document or shadow root adopts only a sheet built by the CSSStyleSheet of its own window; the
// one of this module's realm is refused with a NotAllowedError in the document of an iframe and in
// a shadow root inside it. A document without a window adopts no constructed sheet at all, so the
// call throws for it — before getSheet() puts anything into the cache `sheets`
function newSheetFor(scope: Document | ShadowRoot): CSSStyleSheet {
  // a document is its own owner, and answers ownerDocument with null
  const doc = scope.ownerDocument ?? (scope as Document);
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (view == null) {
    throw new Error(
      'Stylesheets: the root lies in a document without a window, and such a document adopts no ' +
        'constructed stylesheet. Install the rule for a root in a document that a window or a frame shows.',
    );
  }
  return new view.CSSStyleSheet();
}

interface InstalledRule {
  rule: CSSStyleRule;
  css: string;
  /** The `retainRule()` calls that have no `releaseRule()` yet. */
  users: number;
  /** `installRule()` put the rule there, and it stays for good. */
  pinned: boolean;
}

// The rules a sheet already carries, kept per sheet — a name says nothing about which
// sheet holds it.
const installedRules = new WeakMap<CSSStyleSheet, Map<string, InstalledRule>>();

const classNameOf = (name: string): string => `${name}-${postFixID}`;

// A name carries one rule within one root; the rule object stays valid wherever it sits in the
// sheet, so writing through it cannot be thrown off by a rule someone else inserted in front of it.
function putRule(name: string, css: string, root: HTMLElement | ShadowRoot): InstalledRule {
  const sheet = Stylesheets.getSheet(root);

  let rules = installedRules.get(sheet);
  if (rules == null) {
    rules = new Map<string, InstalledRule>();
    installedRules.set(sheet, rules);
  }

  const prevRule = rules.get(name);
  if (prevRule != null) {
    if (prevRule.css !== css) {
      prevRule.rule.style.cssText = css;
      prevRule.css = css;
    }
    return prevRule;
  }

  // escaped, so a name cannot turn the selector into a list or a different selector
  const index = sheet.insertRule(`.${CSS.escape(classNameOf(name))} {${css}}`, sheet.cssRules.length);
  const installed: InstalledRule = {rule: sheet.cssRules[index] as CSSStyleRule, css, users: 0, pinned: false};
  rules.set(name, installed);

  return installed;
}

/**
 * Helpers for installing simple css-class-based rules.
 *
 * The rules live in a constructed stylesheet per document or shadow root, which this module
 * puts into the `adoptedStyleSheets` of that document or shadow root. A shadow root carries its
 * rules before its host is in the document, and keeps them when the host moves.
 *
 * Adopted sheets come after the document's own sheets in the cascade: a rule of the page with
 * the same specificity as these class rules does not win by coming later. Whoever replaces the
 * `adoptedStyleSheets` of a root takes the sheet out; the next call for that root puts it back.
 * A root in a document without a window gets an error that says so.
 */
export class Stylesheets {
  /**
   * The stylesheet this module writes into for `root`: the constructed sheet adopted by the
   * document or shadow root that `root` stands for. It is created on the first call for that
   * document or shadow root, and every call adopts it again if it is missing from
   * `adoptedStyleSheets`.
   *
   * @param root `document.head` by default, which stands for the document. A shadow root carries
   *   a sheet of its own; an element stands for the document or shadow root it sits in, and one
   *   that sits in neither for its document.
   * @throws when `root` lies in a document without a window — one from
   *   `document.implementation.createHTMLDocument()`, a `DOMParser` or the content of a
   *   `<template>` — since such a document adopts no constructed stylesheet. Nothing is cached for
   *   it, and every call throws again.
   */
  static getSheet(root: HTMLElement | ShadowRoot = document.head): CSSStyleSheet {
    const scope = scopeOf(root);
    let sheet = sheets.get(scope);
    if (sheet == null) {
      sheet = newSheetFor(scope);
      sheets.set(scope, sheet);
    }
    // on every call: a framework that writes the adoptedStyleSheets of a root takes the sheet out
    if (!scope.adoptedStyleSheets.includes(sheet)) {
      scope.adoptedStyleSheets = [...scope.adoptedStyleSheets, sheet];
    }
    return sheet;
  }

  /**
   * @deprecated Use {@link Stylesheets.getSheet}: there is one sheet per document or shadow root,
   *   not one global sheet. This name stays as an alias for one release.
   */
  static getGlobalSheet(root: HTMLElement | ShadowRoot = document.head): CSSStyleSheet {
    return Stylesheets.getSheet(root);
  }

  /**
   * Install a className-based rule in the stylesheet of the root.
   *
   * A name carries exactly one rule within one root: a call with a different `css` rewrites that
   * rule, and a call with the `css` it already has does nothing. A rule put here stays in the
   * sheet for good; {@link Stylesheets.releaseRule} does not take it out.
   *
   * @param name The base of the class name
   * @param css The declarations of the rule, as in a style attribute
   * @param root `document.head` by default, which stands for the document. A shadow root carries
   *   a sheet of its own; an element stands for the document or shadow root it sits in, and one
   *   that sits in neither for its document.
   * @returns The postfixed class name
   */
  static installRule(name: string, css: string, root: HTMLElement | ShadowRoot = document.head): string {
    putRule(name, css, root).pinned = true;
    return classNameOf(name);
  }

  /**
   * Install a className-based rule like {@link Stylesheets.installRule} does, and count one user
   * more for it.
   *
   * A name carries exactly one rule within one root: a call with a different `css` rewrites that
   * rule. Pair every call with a {@link Stylesheets.releaseRule} as soon as the user no longer
   * shows the class, for the same document or shadow root: an element that serves as root stands
   * for the one it sits in at each call, and one that moves in between leads the release to
   * another sheet.
   *
   * @param name The base of the class name
   * @param css The declarations of the rule, as in a style attribute
   * @param root `document.head` by default, which stands for the document. A shadow root carries
   *   a sheet of its own; an element stands for the document or shadow root it sits in, and one
   *   that sits in neither for its document.
   * @returns The postfixed class name, the one `installRule()` returns for the name
   */
  static retainRule(name: string, css: string, root: HTMLElement | ShadowRoot = document.head): string {
    putRule(name, css, root).users += 1;
    return classNameOf(name);
  }

  /**
   * Give back a rule taken with {@link Stylesheets.retainRule}. When the last user gives it back,
   * the rule leaves the sheet — unless {@link Stylesheets.installRule} put it there as well.
   *
   * A release without an open retain, or in a root this module never wrote to, does nothing.
   *
   * The document or shadow root is looked up anew on every call: an element that serves as root
   * and has moved between the document and a shadow root since the retain points the release at
   * another sheet, and the retained rule stays.
   *
   * @param name The base of the class name
   * @param root `document.head` by default, which stands for the document. A shadow root carries
   *   a sheet of its own; an element stands for the document or shadow root it sits in, and one
   *   that sits in neither for its document.
   */
  static releaseRule(name: string, root: HTMLElement | ShadowRoot = document.head): void {
    // not getSheet(): a release is no reason to create a sheet, nor to adopt it again
    const sheet = sheets.get(scopeOf(root));
    if (sheet == null) return;

    const rules = installedRules.get(sheet);
    if (rules == null) return;

    const installed = rules.get(name);
    if (installed == null || installed.users === 0) return;

    installed.users -= 1;
    if (installed.users > 0 || installed.pinned) return;

    // the index is looked up now: rules in front of this one may have come or gone since it
    // was inserted
    const index = Array.from(sheet.cssRules).indexOf(installed.rule);
    if (index >= 0) {
      sheet.deleteRule(index);
    }
    // a later retainRule() puts the rule there anew
    rules.delete(name);
  }

  /**
   * Install a rule like {@link Stylesheets.installRule} does and add its class to `element`.
   *
   * The class name carries the postfix of this module, a random hexadecimal number that is the
   * same for every name.
   *
   * @param element The element that gets the class
   * @param name The base of the class name
   * @param css The declarations of the rule, as in a style attribute
   * @param root `document.head` by default, which stands for the document. A shadow root carries
   *   a sheet of its own; an element stands for the document or shadow root it sits in, and one
   *   that sits in neither for its document.
   * @returns The postfixed class name
   */
  static addRule(element: HTMLElement, name: string, css: string, root: HTMLElement | ShadowRoot = document.head): string {
    const className = Stylesheets.installRule(name, css, root);
    element.classList.add(className);
    return className;
  }
}
