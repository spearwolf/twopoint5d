import {ReactNode, useEffect, useState} from 'react';
import {TextureStore as __TextureStore, TextureStoreContext} from '../context/TextureStore';

export interface TextureStoreProps {
  children: ReactNode;
}

export const TextureStore = ({children}: TextureStoreProps) => {
  const [store] = useState<__TextureStore>(new __TextureStore());

  useEffect(() => () => store.dispose());

  return <TextureStoreContext.Provider value={store}>{children}</TextureStoreContext.Provider>;
};
