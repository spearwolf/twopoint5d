import {createContext} from '@lit/context';
import type {IStageRenderer} from '../twopoint5d/IStageRenderer.js';

export const stageRendererContext = createContext<IStageRenderer | undefined>(Symbol('stage-renderer'));
