import { Effects } from "@react-three/drei";
import { extend } from "@react-three/fiber";
import {
  forwardRefValue,
  GetStage2D,
  ParallaxProjection,
  Stage2D,
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
  TextureRef,
  TileSet,
  useFrameLoop,
  useTextureAtlas,
} from "@spearwolf/picimo";
import { useRef } from "react";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";

import { BouncingSprites } from "../textured-sprites/BouncingSprites";

extend({ RenderPass, FilmPass });

export const TexturedSpritesFromTileSet = ({ capacity }) => {
  const geometry = useRef();

  const atlas = useTextureAtlas("tiles");

  useFrameLoop(() => new BouncingSprites(150, 75, 5), {
    geometry: forwardRefValue(geometry),
    atlas,
    capacity,
  });

  return (
    <>
      <TileSet
        name="tiles"
        url="/examples/assets/nobinger-anim-sheet.png"
        tileWidth={64}
        tileHeight={64}
        margin={1}
      />

      <Stage2D name="stage1" noAutoRender defaultCamera>
        <ParallaxProjection plane="xy" origin="bottom left" pixelZoom={4} />

        <TexturedSprites>
          <TexturedSpritesGeometry
            capacity={capacity}
            ref={geometry}
          ></TexturedSpritesGeometry>
          <TexturedSpritesMaterial depthTest={false} depthWrite={false}>
            <TextureRef name="tiles" attach="colorMap" />
          </TexturedSpritesMaterial>
        </TexturedSprites>
      </Stage2D>

      <GetStage2D name="stage1">
        {(stage1) => (
          <Effects disableRenderPass={true}>
            <renderPass args={[stage1.scene, stage1.camera]} />
            <filmPass args={[1, 0.5, 10, 0]} />
          </Effects>
        )}
      </GetStage2D>
    </>
  );
};
