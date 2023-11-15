import {DisplayElement} from '@spearwolf/twopoint5d-elements';
import '@spearwolf/twopoint5d-elements/two5-display.js';
import './display.css';
import './style.css';
import './whenDefined.js';

declare global {
  interface Window {
    DisplayElement: typeof DisplayElement;
  }
}

window.DisplayElement = DisplayElement;

console.log('hello, hello');
