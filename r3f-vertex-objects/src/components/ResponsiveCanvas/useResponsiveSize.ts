import {RefObject, useEffect, useRef, useState} from 'react';

export function useResponsiveSize(containerRef: RefObject<HTMLElement>) {
  const sizeRef = useRef({wPx: 0, hPx: 0, dpr: 0});
  const [size, setSize] = useState({width: 0, height: 0, dpr: 0});

  useEffect(() => {
    let rafId = 0;

    const onFrame = () => {
      rafId = requestAnimationFrame(onFrame);

      const domElement = containerRef?.current;
      if (domElement) {
        const {width, height} = domElement.getBoundingClientRect();
        const styles = getComputedStyle(domElement, null);

        const verticalMargin =
          parseInt(styles.getPropertyValue('border-top-width') || '0', 10) +
          parseInt(styles.getPropertyValue('border-bottom-width') || '0', 10) +
          parseInt(styles.getPropertyValue('padding-top') || '0', 10) +
          parseInt(styles.getPropertyValue('padding-bottom') || '0', 10);
        const horizontalMargin =
          parseInt(styles.getPropertyValue('border-right-width') || '0', 10) +
          parseInt(styles.getPropertyValue('border-left-width') || '0', 10) +
          parseInt(styles.getPropertyValue('padding-left') || '0', 10) +
          parseInt(styles.getPropertyValue('padding-right') || '0', 10);

        const wPx = Math.floor(width - horizontalMargin);
        const hPx = Math.floor(height - verticalMargin);

        const dpr = window.devicePixelRatio || 1;

        if (
          wPx !== sizeRef.current.wPx ||
          hPx !== sizeRef.current.hPx ||
          dpr !== sizeRef.current.dpr
        ) {
          sizeRef.current.wPx = wPx;
          sizeRef.current.hPx = hPx;
          sizeRef.current.dpr = dpr;
          setSize({width: wPx, height: hPx, dpr});
        }
      }
    };

    onFrame();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [containerRef]);

  return size;
}
