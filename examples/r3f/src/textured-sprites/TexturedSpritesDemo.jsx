import {
  forwardRefValue,
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
  useFrameStateMachine,
  useTextureAtlas,
  Stage2D,
  ParallaxProjection,
} from "picimo";
import { useRef } from "react";
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
      <Stage2D>
        <ParallaxProjection plane="xy" origin="bottom left" pixelZoom={2} />
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
