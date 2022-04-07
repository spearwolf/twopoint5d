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
import { useEffect, useRef, useState } from "react";
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

  const [tick, setTick] = useState(1);

  useFrameStateMachine(() => new BouncingSprites(150, 75, 5), {
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
      <Stage2D name="stage0" renderPriority={1}>
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
          <TexturedSpritesMaterial
            colorMap={texture}
            depthTest={false}
            depthWrite={false}
          ></TexturedSpritesMaterial>
        </TexturedSprites>
      </Stage2D>
    </>
  );
};
