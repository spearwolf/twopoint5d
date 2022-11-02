import { Effects } from "@react-three/drei";
import { extend } from "@react-three/fiber";
import {
  forwardRefValue,
  GetStage2D,
  nullableValue,
  ParallaxProjection,
  Stage2D,
  TextureAtlas,
  TexturedSprites,
  TexturedSpritesGeometry,
  TexturedSpritesMaterial,
  TextureRef,
  useFrameLoop,
  useTextureAtlas,
} from "twopoint5d-r3f";
import { useEffect, useRef, useState } from "react";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";

import { LogStageSizeToConsole } from "../utils/LogStageSizeToConsole";
import { WiredBox } from "../utils/WiredBox";
import { BouncingSprites } from "./BouncingSprites";

extend({ RenderPass, FilmPass });

export const DemoOrDie = ({ capacity }) => {
  const geometry = useRef();

  const atlas = useTextureAtlas("atlas0");

  const [tick, setTick] = useState(0);
  const [tack, setTack] = useState(null);

  useFrameLoop(() => new BouncingSprites(150, 75, 5), {
    geometry: forwardRefValue(geometry),
    atlas,
    capacity,
    tick,
    tack: nullableValue(tack),
  });

  useEffect(() => {
    if (tick < 5) {
      setTimeout(() => setTick(tick + 1), 1000);
    } else {
      setTack({ isTack: true });
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

      <Stage2D name="stage0" noAutoRender noAutoClear>
        <ParallaxProjection plane="xy" pixelZoom={1} />

        <LogStageSizeToConsole />

        <WiredBox width={600} height={200} depth={50} />
      </Stage2D>

      <Stage2D name="stage1" noAutoRender noAutoClear defaultCamera>
        <ParallaxProjection
          plane="xy"
          origin="bottom left"
          width={150}
          height={150}
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

      <GetStage2D name={["stage0", "stage1"]}>
        {(stage0, stage1) => (
          <Effects disableRenderPass={true}>
            <renderPass args={[stage0.scene, stage0.camera]} />
            <renderPass
              clear={false}
              clearDepth={true}
              args={[stage1.scene, stage1.camera, undefined, false, false]}
            />
            <filmPass args={[1, 0.5, 10, 0]} />
          </Effects>
        )}
      </GetStage2D>
    </>
  );
};
