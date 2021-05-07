/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export const postFixID = Math.round(Math.random() * (1 << 24)).toString(16);
export const globalStylesID = `three-vertex-objects--${postFixID}`;

let sheet = null;

/**
 * Helpers for installing simple css-class-based rules
 */
export class Stylesheets {
  static getGlobalSheet() {
    if (sheet === null) {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('id', globalStylesID);
      document.head.appendChild(styleEl);
      sheet = styleEl.sheet;
    }
    return sheet;
  }

  static installRule(name, css) {
    const className = `${name}-${postFixID}`;
    const selector = `.${className}`;

    Stylesheets.getGlobalSheet().addRule(selector, css);

    return className;
  }

  /**
   * Install a global className-based style ruleset and add the className to the html element
   * The class name gets a uniq-number as postfix added.
   * @param name The base class name
   * @param css The styles
   * @returns The postfixed class name
   */
  static addRule(element, name, css) {
    const className = Stylesheets.installRule(name, css);
    element.classList.add(className);
    return className;
  }
}
