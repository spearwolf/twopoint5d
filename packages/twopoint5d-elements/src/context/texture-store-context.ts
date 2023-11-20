import {createContext} from '@lit/context';
import type {TextureStore} from '@spearwolf/twopoint5d';

export const textureStoreContext = createContext<TextureStore | undefined>(Symbol('texture-store'));
