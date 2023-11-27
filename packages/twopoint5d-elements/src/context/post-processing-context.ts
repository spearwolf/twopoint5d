import {createContext} from '@lit/context';
import type {Pass} from 'three/addons/postprocessing/Pass.js';

export interface PostProcessingPassElement extends HTMLElement {
  getPass(): Pass;
}

export interface IPostProcessingContext {
  addPassElement(el: PostProcessingPassElement): void;
  removePassElement(el: PostProcessingPassElement): void;
}

export const postProcessingContext = createContext<IPostProcessingContext | undefined>(Symbol('post-processing'));
