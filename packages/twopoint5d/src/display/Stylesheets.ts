import {expectDefined} from '../utils/expectDefined.js';

export const postFixID = Math.round(Math.random() * (1 << 24)).toString(16);
export const globalStylesID = `display3--${postFixID}`;

// One sheet per root: a rule installed for a shadow root has to land in that root, or the
// elements inside it never see it.
const sheets = new WeakMap<HTMLElement | ShadowRoot, CSSStyleSheet>();

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
  const sheet = Stylesheets.getGlobalSheet(root);

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

  const index = sheet.insertRule(`.${classNameOf(name)} {${css}}`, sheet.cssRules.length);
  const installed: InstalledRule = {rule: sheet.cssRules[index] as CSSStyleRule, css, users: 0, pinned: false};
  rules.set(name, installed);

  return installed;
}

/**
 * Helpers for installing simple css-class-based rules
 */
export class Stylesheets {
  /**
   * The stylesheet this module writes into, one per root, created on the first call for that root.
   *
   * @param root default is document.head
   */
  static getGlobalSheet(root: HTMLElement | ShadowRoot = document.head): CSSStyleSheet {
    let sheet = sheets.get(root);
    if (sheet == null) {
      const styleEl = document.createElement('style');
      // The id names this module's sheet for whoever looks into the DOM; nothing ever looks it
      // up, so every root can carry the same one.
      styleEl.setAttribute('id', globalStylesID);
      root.appendChild(styleEl);
      // A <style> element carries a sheet only once it sits in a document — the appendChild above put it there.
      sheet = expectDefined(styleEl.sheet, 'the stylesheet of the freshly appended <style> element');
      sheets.set(root, sheet);
    }
    return sheet;
  }

  /**
   * Install a className-based rule in the global stylesheet.
   *
   * A name carries exactly one rule within one root: a call with a different `css` rewrites that
   * rule, and a call with the `css` it already has does nothing. A rule put here stays in the
   * sheet for good; {@link Stylesheets.releaseRule} does not take it out.
   *
   * @param name The base class name
   * @param css The styles
   * @param root default is document.head; every root carries a stylesheet of its own
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
   * shows the class.
   *
   * @param name The base class name
   * @param css The styles
   * @param root default is document.head; every root carries a stylesheet of its own
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
   * @param name The base class name
   * @param root default is document.head
   */
  static releaseRule(name: string, root: HTMLElement | ShadowRoot = document.head): void {
    // not getGlobalSheet(): a release is no reason to create a sheet
    const sheet = sheets.get(root);
    const rules = sheet && installedRules.get(sheet);
    const installed = rules?.get(name);
    if (sheet == null || rules == null || installed == null || installed.users === 0) return;

    installed.users -= 1;
    if (installed.users > 0 || installed.pinned) return;

    // the index is looked up now: rules in front of this one may have come or gone since it was inserted
    const index = Array.from(sheet.cssRules).indexOf(installed.rule);
    if (index >= 0) {
      sheet.deleteRule(index);
    }
    // a later retainRule() puts the rule there anew
    rules.delete(name);
  }

  /**
   * Install a global className-based style ruleset and add the className to the html element
   * The class name gets a uniq-number as postfix added.
   * @param name The base class name
   * @param css The styles
   * @param root default is document.head
   * @returns The postfixed class name
   */
  static addRule(element: HTMLElement, name: string, css: string, root: HTMLElement | ShadowRoot = document.head): string {
    const className = Stylesheets.installRule(name, css, root);
    element.classList.add(className);
    return className;
  }
}
