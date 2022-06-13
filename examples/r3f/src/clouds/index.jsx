import { Effects, Environment, OrbitControls } from "@react-three/drei";
import { Canvas, extend } from "@react-three/fiber";
import { GetStage2D, ParallaxProjection, Stage2D } from "picimo";
import { createRoot } from "react-dom/client";
import { Vector2 } from "three";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { Clouds } from "./Clouds";

extend({ RenderPass, UnrealBloomPass });

const root = createRoot(document.getElementById("root"));

root.render(
  <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 50] }}>
    <GetStage2D name="stage1">
      {(stage) => <Environment preset="dawn" scene={stage.scene} />}
    </GetStage2D>

    <Stage2D name="stage1" noAutoRender noAutoClear defaultCamera>
      <ParallaxProjection
        plane="xy"
        origin="bottom left"
        width={1920}
        height={1080}
        fit="contain"
      />

      <Clouds
        capacity={200}
        gap={10}
        speed={90}
        width={1920}
        height={400}
        yOffset={-400}
        zOffset={-660}
        fadeInRange={0.1}
        fadeOutRange={0.1}
      />
    </Stage2D>

    <OrbitControls />

    <GetStage2D name="stage1">
      {(stage) => (
        <Effects disableRenderPass={false}>
          {/* <renderPass args={[stage.scene, stage.camera]} clear={false} /> */}
          {/* <unrealBloomPass
            args={[
              new Vector2(window.innerWidth, window.innerHeight),
              1.5,
              0.4,
              0.85,
            ]}
          /> */}
        </Effects>
      )}
    </GetStage2D>
  </Canvas>
);
