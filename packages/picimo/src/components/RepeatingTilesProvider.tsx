import {extend, ReactThreeFiber} from '@react-three/fiber';
import {
  LimitToAxisType,
  RepeatingTilesPatternType,
  RepeatingTilesProvider as __RepeatingTilesProvider,
} from '@spearwolf/tiled-maps';
import {ForwardedRef, forwardRef} from 'react';

extend({RepeatingTilesProvider: __RepeatingTilesProvider});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      repeatingTilesProvider: ReactThreeFiber.Node<__RepeatingTilesProvider, typeof __RepeatingTilesProvider>;
    }
  }
}

export type RepeatingTilesProviderProps = JSX.IntrinsicElements['repeatingTilesProvider'] & {
  horizontal?: boolean;
  vertical?: boolean;
  tile?: number;
  tiles?: RepeatingTilesPatternType;
};

function Component(
  {tile, tiles, horizontal, vertical, limitToAxis: limitToAxisOverride, children, ...props}: RepeatingTilesProviderProps,
  ref: ForwardedRef<__RepeatingTilesProvider>,
) {
  const tileIds: RepeatingTilesPatternType = tiles ?? (typeof tile === 'number' ? tile : 0);

  const limitToAxis: LimitToAxisType =
    limitToAxisOverride ?? (horizontal && vertical ? 'none' : horizontal ? 'horizontal' : vertical ? 'vertical' : 'none');

  return (
    <repeatingTilesProvider args={[tileIds]} attach="tileData" limitToAxis={limitToAxis} ref={ref} {...props}>
      {children}
    </repeatingTilesProvider>
  );
}

Component.displayName = 'RepeatingTilesProvider';

export const RepeatingTilesProvider = forwardRef<__RepeatingTilesProvider, RepeatingTilesProviderProps>(Component);
