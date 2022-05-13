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
import { FrontSide } from "three";
import { createFrameLoopComponent } from "../utils/createFrameLoopComponent";
import { CloudSprites } from "./CloudSprites";

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
  const material = useRef();

  const atlas = useTextureAtlas("clouds");

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
          chunks-discard_by_alpha_fragment={""}
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
