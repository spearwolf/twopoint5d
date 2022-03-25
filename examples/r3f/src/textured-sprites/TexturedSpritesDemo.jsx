import {
  forwardRefValue,
  ParallaxProjection,
  Stage2D,
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
  useFrameStateMachine,
  useTextureAtlas,
} from "picimo";
import { useRef } from "react";
import { LogStageSizeToConsole } from "../utils/LogStageSizeToConsole";
import { WiredBox } from "../utils/WiredBox";
import { BouncingSprites } from "./BouncingSprites";

export const TexturedSpritesDemo = ({ capacity }) => {
  const { texture, atlas } = useTextureAtlas(
    "/examples/assets/lab-walls-tiles.json",
    ["nearest"],
    { overrideImageUrl: "/examples/assets/lab-walls-tiles.png" }
  );

  const geometry = useRef();

  useFrameStateMachine(() => new BouncingSprites(150, 75, 5), {
    geometry: forwardRefValue(geometry),
    atlas,
    capacity,
  });

  return (
    <>
      <Stage2D name="stage0">
        <ParallaxProjection plane="xy" origin="bottom left" pixelZoom={2} />
        <WiredBox width={150} height={50} depth={50} />
        <LogStageSizeToConsole />
      </Stage2D>

      <TexturedSprites>
        <TexturedSpritesGeometry
          capacity={capacity}
          ref={geometry}
        ></TexturedSpritesGeometry>
        <TexturedSpritesMaterial
          colorMap={texture}
          depthTest={false}
          depthWrite={false}
        ></TexturedSpritesMaterial>
      </TexturedSprites>
    </>
  );
};
