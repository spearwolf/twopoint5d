import {expectDefined} from '../utils/expectDefined.js';

export const postFixID = Math.round(Math.random() * (1 << 24)).toString(16);
export const globalStylesID = `display3--${postFixID}`;

let sheet: CSSStyleSheet | null = null;

// `getGlobalSheet()` hands out the same sheet for the whole module run, and this map keeps its
// entries under that assumption. Whoever introduces a second sheet keeps one map per sheet.
const installedRules = new Map<string, {rule: CSSStyleRule; css: string}>();

/**
 * Helpers for installing simple css-class-based rules
 */
export class Stylesheets {
  static getGlobalSheet(root: HTMLElement | ShadowRoot = document.head): CSSStyleSheet {
    if (sheet === null) {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('id', globalStylesID);
      root.appendChild(styleEl);
      // A <style> element carries a sheet only once it sits in a document — the appendChild above put it there.
      sheet = expectDefined(styleEl.sheet, 'the stylesheet of the freshly appended <style> element');
    }
    return sheet;
  }

  /**
   * Install a className-based rule in the global stylesheet.
   *
   * A name carries exactly one rule: a call with a different `css` rewrites that rule, and a call
   * with the `css` it already has does nothing.
   *
   * @param name The base class name
   * @param css The styles
   * @param root default is document.head
   * @returns The postfixed class name
   */
  static installRule(name: string, css: string, root: HTMLElement | ShadowRoot = document.head): string {
    const sheet = Stylesheets.getGlobalSheet(root);

    const className = `${name}-${postFixID}`;

    const prevRule = installedRules.get(name);
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
    installedRules.set(name, {rule: sheet.cssRules[index] as CSSStyleRule, css});

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
