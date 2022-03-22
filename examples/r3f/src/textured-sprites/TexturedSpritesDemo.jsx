import { extend } from "@react-three/fiber";
import { forwardRefValue, useFrameStateMachine } from "@spearwolf/kobolde";
import {
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
} from "@spearwolf/textured-sprites";
import { useRef, useState } from "react";
import { BouncingSprites } from "./BouncingSprites";
import { useTileSet } from "./useTileSet";

extend({ TexturedSprites, TexturedSpritesGeometry, TexturedSpritesMaterial });

export const TexturedSpritesDemo = ({ capacity }) => {
  const geometry = useRef();

  const [bouncingSprites] = useState(() => new BouncingSprites(150, 75, 5));

  const { tileSet, texture } = useTileSet(
    "/examples/assets/nobinger-anim-sheet.png",
    {
      tileHeight: 64,
      tileWidth: 64,
      margin: 1,
    }
  );

  useFrameStateMachine(bouncingSprites, {
    geometry: forwardRefValue(geometry),
    atlas: tileSet?.atlas,
    capacity,
  });

  return (
    <texturedSprites>
      <texturedSpritesGeometry
        args={[capacity]}
        ref={geometry}
      ></texturedSpritesGeometry>
      <texturedSpritesMaterial
        colorMap={texture}
        depthTest={false}
        depthWrite={false}
      ></texturedSpritesMaterial>
    </texturedSprites>
  );
};
