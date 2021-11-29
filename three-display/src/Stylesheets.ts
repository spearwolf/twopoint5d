export const postFixID = Math.round(Math.random() * (1 << 24)).toString(16);
export const globalStylesID = `three-display--${postFixID}`;

let sheet: CSSStyleSheet = null;

/**
 * Helpers for installing simple css-class-based rules
 */
export class Stylesheets {
  static getGlobalSheet(): CSSStyleSheet {
    if (sheet === null) {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('id', globalStylesID);
      document.head.appendChild(styleEl);
      sheet = styleEl.sheet;
    }
    return sheet;
  }

  static installRule(name: string, css: string): string {
    const className = `${name}-${postFixID}`;
    const selector = `.${className}`;

    let ruleExists = false;

    const sheet = Stylesheets.getGlobalSheet();
    for (const rule of Array.from(sheet.cssRules) as CSSStyleRule[]) {
      if (selector === rule.selectorText) {
        ruleExists = true;
        break;
      }
    }

    if (!ruleExists) {
      sheet.insertRule(`${selector} {${css}}`);
    }

    return className;
  }

  /**
   * Install a global className-based style ruleset and add the className to the html element
   * The class name gets a uniq-number as postfix added.
   * @param name The base class name
   * @param css The styles
   * @returns The postfixed class name
   */
  static addRule(element: HTMLElement, name: string, css: string): string {
    const className = Stylesheets.installRule(name, css);
    element.classList.add(className);
    return className;
  }
}
