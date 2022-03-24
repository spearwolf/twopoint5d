import {extend, ReactThreeFiber} from '@react-three/fiber';
import {ParallaxProjection as __ParallaxProjection, ProjectionPlane, ProjectionPlaneDescription} from '@spearwolf/stage25';
import {forwardRef, Ref} from 'react';

extend({ParallaxProjection: __ParallaxProjection});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      parallaxProjection: ReactThreeFiber.Object3DNode<
        __ParallaxProjection,
        typeof __ParallaxProjection & JSX.IntrinsicElements['primitive']
      >;
    }
  }
}

export type ParallaxProjectionParams = {
  projectionPlane?: ProjectionPlane | ProjectionPlaneDescription;
  width?: number;
  height?: number;
  fit?: 'fill' | 'contain';
  pixelZoom?: number;
  minPixelZoom?: number;
  maxPixelZoom?: number;
} & JSX.IntrinsicElements['parallaxProjection'];

function Component(
  {
    projectionPlane,
    width,
    height,
    fit,
    pixelZoom,
    minPixelZoom,
    maxPixelZoom,
    attach,
    attachArray,
    attachFns,
    attachObject,
    children,
    ...props
  }: ParallaxProjectionParams,
  ref: Ref<__ParallaxProjection>,
) {
  const attachProps = {attach, attachArray, attachFns, attachObject};
  if (!Object.values(attachProps).some((val) => val)) {
    attachProps.attach = 'projection';
  }

  return (
    <parallaxProjection
      args={[projectionPlane, {width, height, fit, pixelZoom, minPixelZoom, maxPixelZoom}]}
      ref={ref}
      {...attachProps}
      {...props}
    >
      {children}
    </parallaxProjection>
  );
}

Component.displayName = 'ParallaxProjection';

export const ParallaxProjection = forwardRef<__ParallaxProjection, ParallaxProjectionParams>(Component);
