import {
  forwardRefValue,
  ShaderChunks,
  TextureAtlas,
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
  TextureRef,
  useFrameLoop,
  useTextureAtlas,
} from "twopoint5d-r3f";
import { useEffect, useRef } from "react";
import { FrontSide } from "three";
import { createFrameLoopComponent } from "../utils/createFrameLoopComponent";
import { CloudSprites } from "./CloudSprites";

const ShaderLib = {
  fadeInOutZRange_uniform: `
    uniform vec4 fadeInOutZRange;
  `,

  fadeInOutAlpha_varying: `
    varying float vFadeInOutAlpha;
  `,

  extra_pars_vertex: `
    #include <fadeInOutZRange_uniform>
    #include <fadeInOutAlpha_varying>
  `,

  extra_pars_fragment: `
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
}) => {
  const geometry = useRef();
  const material = useRef();

  const atlas = useTextureAtlas("clouds");

  useEffect(() => {
    material.current.uniforms.fadeInOutZRange = { value: [0, 0, 0, 0] };
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
  });

  return (
    <>
      <TextureAtlas
        name="clouds"
        url="/examples/assets/clouds.json"
        overrideImageUrl="/examples/assets/clouds.png"
        anisotrophy
      />

      <TexturedSprites>
        <TexturedSpritesGeometry
          capacity={capacity}
          ref={geometry}
        ></TexturedSpritesGeometry>
        <TexturedSpritesMaterial
          ref={material}
          depthTest={false}
          depthWrite={false}
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
};
