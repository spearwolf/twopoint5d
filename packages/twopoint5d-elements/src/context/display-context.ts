import {createContext} from '@lit/context';
import type {Display} from '@spearwolf/twopoint5d';

export const displayContext = createContext<Display | undefined>(Symbol('display'));
