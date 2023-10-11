import {type ReactNode, useEffect, useState} from 'react';
import {AssetStore as __AssetStore, AssetStoreContext} from '../context/AssetStore.js';

export interface AssetStoreProps {
  children: ReactNode;
}

export const AssetStore = ({children}: AssetStoreProps) => {
  const [store] = useState<__AssetStore>(new __AssetStore());

  useEffect(() => () => store.dispose());

  return <AssetStoreContext.Provider value={store}>{children}</AssetStoreContext.Provider>;
};
