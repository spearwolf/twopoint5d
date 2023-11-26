import {createContext} from '@lit/context';
import type {PostProcessingRenderer} from '@spearwolf/twopoint5d';

export interface IPostProcessingContext {
  renderer: PostProcessingRenderer;
}

export const postProcessingContext = createContext<IPostProcessingContext | undefined>(Symbol('post-processing'));
