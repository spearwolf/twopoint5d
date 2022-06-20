import { extend } from "@react-three/fiber";
import {
  forwardRefValue,
  ParallaxProjection,
  Stage2D,
  TextureAtlas,
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
  TextureRef,
  useFrameLoop,
  useTextureAtlas,
} from "picimo";
import { useEffect, useRef, useState } from "react";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { LogStageSizeToConsole } from "../utils/LogStageSizeToConsole";
import { WiredBox } from "../utils/WiredBox";
import { BouncingSprites } from "./BouncingSprites";

extend({ RenderPass, UnrealBloomPass });

export const TexturedSpritesDemo = ({ capacity }) => {
  const geometry = useRef();

  const atlas = useTextureAtlas("atlas0");

  const [tick, setTick] = useState(0);

  useFrameLoop(() => new BouncingSprites(150, 75, 5), {
    geometry: forwardRefValue(geometry),
    atlas,
    capacity,
    tick,
  });

  useEffect(() => {
    if (tick < 5) {
      setTimeout(() => setTick(tick + 1), 1000);
    }
  }, [tick]);

  return (
    <>
      <TextureAtlas
        name="atlas0"
        url="/examples/assets/lab-walls-tiles.json"
        nearest
        overrideImageUrl="/examples/assets/lab-walls-tiles.png"
      />

      <Stage2D name="stage0" noAutoRender={false} renderPriority={1}>
        <ParallaxProjection plane="xy" pixelZoom={1} />

        <LogStageSizeToConsole />

        <WiredBox width={600} height={200} depth={50} />
      </Stage2D>

      <Stage2D name="stage1" noAutoClear defaultCamera renderPriority={2}>
        <ParallaxProjection
          plane="xy"
          origin="bottom left"
          width={200}
          height={100}
          fit="contain"
        />

        <LogStageSizeToConsole />

        <TexturedSprites>
          <TexturedSpritesGeometry
            capacity={capacity}
            ref={geometry}
          ></TexturedSpritesGeometry>
          <TexturedSpritesMaterial depthTest={false} depthWrite={false}>
            <TextureRef name="atlas0" attach="colorMap" />
          </TexturedSpritesMaterial>
        </TexturedSprites>
      </Stage2D>

      {/* <GetStage2D name="stage1">
        {(stage) => (
          <Effects disableRenderPass={true}>
            <renderPass args={[stage.scene, stage.camera]} />
            <unrealBloomPass
              args={[
                new Vector2(window.innerWidth, window.innerHeight),
                1.5,
                0.4,
                0.85,
              ]}
            />
          </Effects>
        )}
      </GetStage2D> */}
    </>
  );
};
