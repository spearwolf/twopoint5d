import {extend, ReactThreeFiber} from '@react-three/fiber';
import {ParallaxProjection as __ParallaxProjection, ProjectionPlane, ProjectionPlaneDescription} from '@twopoint5d/core';
import {ForwardedRef, forwardRef, useContext, useEffect, useState} from 'react';
import {mergeRefs} from '../utils/mergeRefs';
import {Stage2DContext} from './Stage2D';

extend({ParallaxProjection: __ParallaxProjection});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      parallaxProjection: ReactThreeFiber.Node<__ParallaxProjection, typeof __ParallaxProjection>;
    }
  }
}

export type ProjectionPlaneProps = {
  projectionPlane?: ProjectionPlane;
  plane: 'xy' | 'XY' | 'xz' | 'XZ';
  origin?: 'bottom left' | 'top left' | 'left bottom' | 'left top';
};

export type ParallaxProjectionParams = JSX.IntrinsicElements['parallaxProjection'] &
  ProjectionPlaneProps & {
    width?: number;
    height?: number;
    fit?: 'fill' | 'contain';
    pixelZoom?: number;
    minPixelZoom?: number;
    maxPixelZoom?: number;
    distanceToProjectionPlane?: number;
    near?: number;
    far?: number;
  };

const parseProjectionOrigin = (origin: string): 'bottom-left' | 'top-left' =>
  origin.indexOf('top') === -1 ? 'bottom-left' : 'top-left';

const readProjectionPlane = (params: ProjectionPlaneProps): ProjectionPlane | ProjectionPlaneDescription =>
  (params as {projectionPlane: ProjectionPlane}).projectionPlane ??
  `${(params as {plane: string}).plane.toLowerCase() === 'xy' ? 'xy' : 'xz'}|${parseProjectionOrigin(
    (params as {origin: string}).origin,
  )}`;

const DEFAULT_PLANE = 'xy';
const DEFAULT_ORIGIN = 'bottom left';

function Component(
  {
    projectionPlane,
    plane,
    origin,
    width,
    height,
    fit,
    pixelZoom,
    minPixelZoom,
    maxPixelZoom,
    distanceToProjectionPlane,
    near,
    far,
    attach,
    children,
    ...props
  }: ParallaxProjectionParams,
  ref: ForwardedRef<__ParallaxProjection>,
) {
  const [initialProjectionPlane, setInitialProjectionPlane] = useState(
    readProjectionPlane({projectionPlane, plane: plane ?? DEFAULT_PLANE, origin: origin ?? DEFAULT_ORIGIN}),
  );

  useEffect(() => {
    if (projectionPlane != null) {
      if (!(typeof initialProjectionPlane === 'object' && initialProjectionPlane.equals(projectionPlane))) {
        setInitialProjectionPlane(projectionPlane);
      }
    } else {
      setInitialProjectionPlane(readProjectionPlane({plane: plane ?? DEFAULT_PLANE, origin: origin ?? DEFAULT_ORIGIN}));
    }
  }, [projectionPlane, plane, origin]);

  const stage = useContext(Stage2DContext);
  const [projection, setProjection] = useState<__ParallaxProjection>();

  useEffect(() => {
    if (stage && projection) {
      stage.projection = projection;
    }
  }, [stage, projection]);

  useEffect(() => {
    if (stage) {
      stage.needsUpdate = true;
    }
  }, [stage, width, height, fit, pixelZoom, minPixelZoom, maxPixelZoom, distanceToProjectionPlane, near, far]);

  return (
    <parallaxProjection
      args={[initialProjectionPlane]}
      attach={attach ?? 'projection'}
      ref={mergeRefs(setProjection, ref)}
      viewSpecs-width={width}
      viewSpecs-height={height}
      viewSpecs-fit={fit}
      viewSpecs-pixelZoom={pixelZoom}
      viewSpecs-minPixelZoom={minPixelZoom}
      viewSpecs-maxPixelZoom={maxPixelZoom}
      viewSpecs-distanceToProjectionPlane={distanceToProjectionPlane}
      viewSpecs-near={near}
      viewSpecs-far={far}
      {...props}
    >
      {children}
    </parallaxProjection>
  );
}

Component.displayName = 'ParallaxProjection';

export const ParallaxProjection = forwardRef<__ParallaxProjection, ParallaxProjectionParams>(Component);
