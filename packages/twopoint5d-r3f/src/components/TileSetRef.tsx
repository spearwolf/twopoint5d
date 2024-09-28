import '@react-three/fiber';
import {TileSet, unpick} from '@spearwolf/twopoint5d';
import {forwardRef, type ForwardedRef} from 'react';
import {useTileSet} from '../hooks/useTileSet.js';

export type TileSetRefProps = JSX.IntrinsicElements['primitive'] & {
  name: string | symbol;
};

function Component({name, children, ...props}: TileSetRefProps, ref: ForwardedRef<TileSet>) {
  const tileset = useTileSet(name);
  const propsWithoutObject = unpick(props, 'object');

  return tileset ? (
    <primitive object={tileset} ref={ref} {...propsWithoutObject}>
      {children}
    </primitive>
  ) : null;
}

Component.displayName = 'TileSetRef';

export const TileSetRef = forwardRef<TileSet, TileSetRefProps>(Component as any);
