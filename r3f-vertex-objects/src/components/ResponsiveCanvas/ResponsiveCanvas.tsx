import {render, RenderProps, unmountComponentAtNode} from '@react-three/fiber';
import {
  Component,
  Dispatch,
  forwardRef,
  ReactNode,
  SetStateAction,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import mergeRefs from 'react-merge-refs';

import {useResponsiveSize} from './useResponsiveSize';

export interface Props
  extends Omit<RenderProps<HTMLCanvasElement>, 'size' | 'events'>,
    React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  fallback?: ReactNode;
  events?: any;
}

type SetBlock = false | Promise<null> | null;
type UnblockProps = {
  set: Dispatch<SetStateAction<SetBlock>>;
  children: ReactNode;
};

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function Block({set}: Omit<UnblockProps, 'children'>): any {
  useIsomorphicLayoutEffect(() => {
    set(new Promise(() => null));
    return () => set(false);
  }, []);
  return null;
}

class ErrorBoundary extends Component<{set: Dispatch<any>}, {error: boolean}> {
  state = {error: false};

  static getDerivedStateFromError = () => ({error: true});

  componentDidCatch(error: any) {
    this.props.set(error);
  }

  render() {
    return this.state.error ? null : this.props.children;
  }
}

/**
 * Based upon the `Canvas` component from [react-three-fiber](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/web/Canvas.tsx).
 * But this time _without_ [react-use-measure](https://github.com/pmndrs/react-use-measure) (which is in my eyes somehwat broken).
 *
 * This canvas component reacts in a responsive manner to the container element size __and__ to `window.devicePixelRatio` changes!
 */
export const ResponsiveCanvas = forwardRef<HTMLCanvasElement, Props>(
  function Canvas(
    {children, fallback, tabIndex, id, style, className, events, ...props},
    forwardedRef,
  ) {
    const containerRef = useRef();
    const size = useResponsiveSize(containerRef);
    const canvasRef = useRef(null);
    const [block, setBlock] = useState<SetBlock>(false);
    const [error, setError] = useState(false);
    // Suspend this component if block is a promise (2nd run)
    if (block) throw block;
    // Throw exception outwards if anything within canvas throws
    if (error) throw error;

    // Execute JSX in the reconciler as a layout-effect
    useIsomorphicLayoutEffect(() => {
      if (size.width > 0 && size.height > 0) {
        render(
          <ErrorBoundary set={setError}>
            <Suspense fallback={<Block set={setBlock} />}>{children}</Suspense>
          </ErrorBoundary>,
          canvasRef.current,
          {...props, size, dpr: size.dpr, events},
        );
      }
    }, [size, children]);

    useIsomorphicLayoutEffect(() => {
      const container = canvasRef.current;
      return () => unmountComponentAtNode(container);
    }, []);

    return (
      <div
        ref={containerRef}
        id={id}
        className={className}
        tabIndex={tabIndex}
        style={{
          height: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative',
          ...style,
        }}
      >
        <canvas
          ref={mergeRefs([canvasRef, forwardedRef])}
          style={{position: 'absolute', top: 0, left: 0}}
        >
          {fallback}
        </canvas>
      </div>
    );
  },
);
