import {expectDefined} from '../utils/expectDefined.js';

export const postFixID = Math.round(Math.random() * (1 << 24)).toString(16);
export const globalStylesID = `display3--${postFixID}`;

// One sheet per root: a rule installed for a shadow root has to land in that root, or the
// elements inside it never see it.
const sheets = new WeakMap<HTMLElement | ShadowRoot, CSSStyleSheet>();

// The rules a sheet already carries, kept per sheet — a name says nothing about which
// sheet holds it.
const installedRules = new WeakMap<CSSStyleSheet, Map<string, {rule: CSSStyleRule; css: string}>>();

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
   * rule, and a call with the `css` it already has does nothing.
   *
   * @param name The base class name
   * @param css The styles
   * @param root default is document.head; every root carries a stylesheet of its own
   * @returns The postfixed class name
   */
  static installRule(name: string, css: string, root: HTMLElement | ShadowRoot = document.head): string {
    const sheet = Stylesheets.getGlobalSheet(root);

    let rules = installedRules.get(sheet);
    if (rules == null) {
      rules = new Map<string, {rule: CSSStyleRule; css: string}>();
      installedRules.set(sheet, rules);
    }

    const className = `${name}-${postFixID}`;

    const prevRule = rules.get(name);
    if (prevRule != null) {
      if (prevRule.css === css) {
        return className;
      }
      // the rule object stays valid wherever it sits in the sheet: writing through it
      // cannot be thrown off by a rule someone else inserted in front of it
      prevRule.rule.style.cssText = css;
      prevRule.css = css;
      return className;
    }

    const index = sheet.insertRule(`.${className} {${css}}`, sheet.cssRules.length);
    rules.set(name, {rule: sheet.cssRules[index] as CSSStyleRule, css});

    return className;
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
