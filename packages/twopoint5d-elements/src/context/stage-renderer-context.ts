import {createContext} from '@lit/context';
import type {IStageRenderer} from '@spearwolf/twopoint5d';

export const stageRendererContext = createContext<IStageRenderer | undefined>(Symbol('stage-renderer'));
