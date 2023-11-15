import {
  ShaderChunks,
  TextureAtlas,
  TextureRef,
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
  forwardRefValue,
  useFrameLoop,
  useTextureAtlas,
} from '@spearwolf/twopoint5d-r3f';
import {useEffect, useRef} from 'react';
import {AdditiveBlending, FrontSide} from 'three';
import assetsUrl from '../../../demos/utils/assetsUrl.ts';
import {createFrameLoopComponent} from '../../../demos/utils/createFrameLoopComponent.js';
import {CloudSprites} from './CloudSprites.js';

const ShaderLib = {
  fadeInOutZRange_uniform: `
    uniform vec4 fadeInOutZRange;
  `,

  postAlpha_uniform: `
    uniform float postAlphaMultiplier;
  `,

  fadeInOutAlpha_varying: `
    varying float vFadeInOutAlpha;
  `,

  extra_pars_vertex: `
    #include <fadeInOutZRange_uniform>
    #include <fadeInOutAlpha_varying>
  `,

  extra_pars_fragment: `
    #include <postAlpha_uniform>
    #include <fadeInOutAlpha_varying>
  `,

  post_main_vertex: `
    if (vertexPosition.z <= fadeInOutZRange.z) {
      vFadeInOutAlpha = smoothstep(fadeInOutZRange.x, fadeInOutZRange.y, vertexPosition.z);
    } else {
      vFadeInOutAlpha = 1.0 - smoothstep(fadeInOutZRange.z, fadeInOutZRange.w, vertexPosition.z);
    }
  `,

  discard_by_alpha_fragment: `
    gl_FragColor.a *= vFadeInOutAlpha;
    gl_FragColor.a *= postAlphaMultiplier;

    if (gl_FragColor.a == 0.0) {
      discard;
    }
  `,
};

export const Clouds = ({
  capacity,
  gap,
  width,
  height,
  xOffset,
  yOffset,
  zOffset,
  speed,
  fadeInRange,
  fadeOutRange,
  postAlphaMultiplier,
}) => {
  const geometry = useRef();
  const material = useRef();

  const atlas = useTextureAtlas('clouds');

  useEffect(() => {
    // initialize extra uniforms to ensure that they are available in the shader
    material.current.uniforms.fadeInOutZRange = {value: [0, 0, 0, 0]};
    material.current.uniforms.postAlphaMultiplier = {value: 0};
  }, [material]);

  useFrameLoop(createFrameLoopComponent(CloudSprites), {
    geometry: forwardRefValue(geometry),
    material: forwardRefValue(material),
    atlas,
    capacity,
    gap,
    width,
    height,
    xOffset,
    yOffset,
    zOffset,
    speed,
    fadeInRange,
    fadeOutRange,
    postAlphaMultiplier,
  });

  return (
    <>
      <TextureAtlas name="clouds" url={assetsUrl('clouds-2.json')} overrideImageUrl={assetsUrl('clouds-2.png')} anisotrophy />

      <TexturedSprites>
        <TexturedSpritesGeometry capacity={capacity} ref={geometry}></TexturedSpritesGeometry>
        <TexturedSpritesMaterial
          ref={material}
          depthTest={false}
          depthWrite={false}
          blending={AdditiveBlending}
          side={FrontSide}
          logShadersToConsole={true}
        >
          <TextureRef name="clouds" attach="colorMap" />
          <ShaderChunks chunks={ShaderLib} />
        </TexturedSpritesMaterial>
      </TexturedSprites>
    </>
  );
};

Clouds.defaultProps = {
  capacity: 500,
  gap: 1,
  width: 1920,
  height: 1080,
  xOffset: 0,
  yOffset: 0,
  zOffset: 0,
  speed: 5,
  fadeInRange: 0.1,
  fadeOutRange: 0.2,
  postAlphaMultiplier: 1.0,
};
