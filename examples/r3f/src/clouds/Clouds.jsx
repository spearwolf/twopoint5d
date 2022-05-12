import {
  forwardRefValue,
  TextureAtlas,
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
  TextureRef,
  useFrameLoop,
  useTextureAtlas,
} from "picimo";
import { useRef } from "react";
import { createFrameLoopComponent } from "../utils/createFrameLoopComponent";
import { CloudSprites } from "./CloudSprites";

const fragmentShader = `
  uniform sampler2D colorMap;

  varying vec2 vTexCoords;

  void main() {
    gl_FragColor = texture2D(colorMap, vTexCoords);
  }
`;

export const Clouds = ({
  capacity,
  gap,
  width,
  height,
  xOffset,
  yOffset,
  zOffset,
  speed,
}) => {
  const geometry = useRef();

  const atlas = useTextureAtlas("clouds");

  useFrameLoop(createFrameLoopComponent(CloudSprites), {
    geometry: forwardRefValue(geometry),
    atlas,
    capacity,
    gap,
    width,
    height,
    xOffset,
    yOffset,
    zOffset,
    speed,
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
          depthTest={false}
          depthWrite={false}
          fragmentShader={fragmentShader}
        >
          <TextureRef name="clouds" attach="colorMap" />
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
};
