import '@react-three/fiber';
import {TileSet, unpick} from '@twopoint5d/core';
import {ForwardedRef, forwardRef} from 'react';
import {useTileSet} from '../hooks/useTileSet';

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

export const TileSetRef = forwardRef<TileSet, TileSetRefProps>(Component);
