import {
  forwardRefValue,
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
  useFrameStateMachine,
} from "@spearwolf/kobolde";
import { useRef } from "react";
import { BouncingSprites } from "./BouncingSprites";
import { useTileSet } from "./useTileSet";

export const TexturedSpritesDemo = ({ capacity }) => {
  const { tileSet, texture } = useTileSet(
    "/examples/assets/nobinger-anim-sheet.png",
    {
      tileHeight: 64,
      tileWidth: 64,
      margin: 1,
    }
  );

  const geometry = useRef();

  useFrameStateMachine(() => new BouncingSprites(150, 75, 5), {
    geometry: forwardRefValue(geometry),
    atlas: tileSet?.atlas,
    capacity,
  });

  return (
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
  );
};
