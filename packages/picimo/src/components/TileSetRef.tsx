import '@react-three/fiber';
import {TileSet} from '@spearwolf/vertex-objects';
import {ForwardedRef, forwardRef} from 'react';
import {useTileSet} from '../hooks/useTileSet';

export type TileSetRefProps = JSX.IntrinsicElements['primitive'] & {
  name: string | symbol;
};

function Component({name, children, ...props}: TileSetRefProps, ref: ForwardedRef<TileSet>) {
  const tileset = useTileSet(name);

  return tileset ? (
    <primitive object={tileset} ref={ref} {...props}>
      {children}
    </primitive>
  ) : null;
}

Component.displayName = 'TileSetRef';

export const TileSetRef = forwardRef<TileSet, TileSetRefProps>(Component);
