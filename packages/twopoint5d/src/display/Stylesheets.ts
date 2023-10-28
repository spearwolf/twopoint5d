export const postFixID = Math.round(Math.random() * (1 << 24)).toString(16);
export const globalStylesID = `display3--${postFixID}`;

let sheet: CSSStyleSheet = null;

const installedRules: Map<string, {index: number; css: string}> = new Map();

/**
 * Helpers for installing simple css-class-based rules
 */
export class Stylesheets {
  static getGlobalSheet(root: HTMLElement | ShadowRoot = document.head): CSSStyleSheet {
    if (sheet === null) {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('id', globalStylesID);
      root.appendChild(styleEl);
      sheet = styleEl.sheet;
    }
    return sheet;
  }

  static installRule(name: string, css: string, root: HTMLElement | ShadowRoot = document.head): string {
    const sheet = Stylesheets.getGlobalSheet(root);

    const className = `${name}-${postFixID}`;
    const selector = `.${className}`;

    let index = sheet.cssRules.length;

    if (installedRules.has(name)) {
      const prevRule = installedRules.get(name);
      if (prevRule.css === css) {
        return className;
      }
      index = prevRule.index;
    }

    sheet.insertRule(`${selector} {${css}}`, index);

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
