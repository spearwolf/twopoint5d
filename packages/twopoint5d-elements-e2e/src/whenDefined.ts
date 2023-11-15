import {whenDefined} from '@spearwolf/twopoint5d-elements';

declare global {
  interface Window {
    whenDefined: typeof whenDefined;
  }
}

window.whenDefined = whenDefined;
