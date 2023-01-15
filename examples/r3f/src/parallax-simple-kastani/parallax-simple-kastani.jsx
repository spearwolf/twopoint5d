import { Effects, OrbitControls } from "@react-three/drei";
import { extend, useThree } from "@react-three/fiber";
import { button, useControls } from "leva";
import { useEffect, useRef, useState } from "react";
import { CameraHelper, Euler, MathUtils, Matrix4 } from "three";
import { CameraBasedVisibility, printSceneGraphToConsole } from "twopoint5d";
import {
  Map2DLayer3D,
  Map2DTileSprites,
  PanControl2D,
  ParallaxProjection,
  RepeatingTilesProvider,
  Stage2D,
  TextureRef,
  TileSet,
  TileSetRef,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from "twopoint5d-r3f";

import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { SepiaShader } from "three/examples/jsm/shaders/SepiaShader";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader";

import { WiredBox } from "../utils/WiredBox";

extend({
  CameraBasedVisibility,
  CameraHelper,
  RenderPass,
  ShaderPass,
});

let debugUsageInfoIsShown = false;

function printDebugUsageInfo() {
  if (debugUsageInfoIsShown) return;
  const styles = "font-weight:bold;color:#dd0044";
  console.info(
    `%c!!! to use the debug feature, press <Ctrl+.> and change the view.`,
    styles
  );
  console.info(
    `%ceach layer that is set to debug will then print the debug info to the console !!!`,
    styles
  );
  debugUsageInfoIsShown = true;
}

export const Map2DImageLayer = ({
  name,
  imageUrl,
  width,
  height,
  offsetX = 0,
  offsetY = 0,
  centerX,
  centerY,
  camera,
  debugNextVisibleTiles = false,
  showHelpers = false,
  horizontal = false,
  vertical = false,
  matrix = new Matrix4(),
  visible = true,
}) => {
  const map2dRef = useRef();

  useEffect(() => {
    const onKeyup = (event) => {
      if (event.ctrlKey && event.code === "Period") {
        if (debugNextVisibleTiles && map2dRef.current.visibilitor) {
          map2dRef.current.visibilitor.debugNextVisibleTiles = true;
        }
      }
    };

    window.addEventListener("keyup", onKeyup);
    return () => window.removeEventListener("keyup", onKeyup);
  }, [debugNextVisibleTiles]);

  return (
    <>
      <TileSet
        name={name}
        url={imageUrl}
        tileWidth={width}
        tileHeight={height}
      />

      <Map2DLayer3D
        name={name}
        ref={map2dRef}
        matrix={matrix}
        matrixAutoUpdate={false}
        tileWidth={width}
        tileHeight={height}
        xOffset={offsetX}
        yOffset={offsetY}
        centerX={centerX}
        centerY={centerY}
        updateOnFrame
        visible={visible}
      >
        <cameraBasedVisibility
          camera={camera}
          lookAtCenter={false}
          depth={10}
          attach="visibilitor"
          showHelpers={showHelpers}
        />

        <Map2DTileSprites>
          <RepeatingTilesProvider
            tile={1}
            horizontal={horizontal}
            vertical={vertical}
          />
          <TileSetRef name={name} attach="tileSet" />
          <TileSpritesGeometry capacity={100} />
          <TileSpritesMaterial fogColor={[0.1, 0.1, 0.4, 1]} fogFar={1500}>
            <TextureRef name={name} attach="colorMap" />
          </TileSpritesMaterial>
        </Map2DTileSprites>
      </Map2DLayer3D>
    </>
  );
};

const xyTransform = new Matrix4().makeRotationFromEuler(
  new Euler(MathUtils.degToRad(90), 0, 0)
);

const forefrontTransform = new Matrix4().makeTranslation(0, 300, 0); // 0, 225, -200);
const frontTransform = new Matrix4().makeTranslation(0, 250, 0); // 0, 270, -100);
const middleTransform = new Matrix4().makeTranslation(0, 0, 0); // 0, 90, 0);
const backTransform = new Matrix4().makeTranslation(0, -250, 0); // 0, -180, 150);

export const DemoOrDie = () => {
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const camera = useThree((state) => state.camera);
  const rootNode = useRef();

  useEffect(printDebugUsageInfo);

  const { showBox } = useControls({
    showBox: true,
    printGraph2console: button(() => {
      if (rootNode.current) {
        printSceneGraphToConsole(rootNode.current, true);
      }
    }),
  });

  const {
    show: back_show,
    debug: back_debugNextVisibleTiles,
    showHelpers: back_showHelpers,
  } = useControls("back", {
    show: true,
    debug: false,
    showHelpers: false,
  });

  const {
    show: middle_show,
    debug: middle_debugNextVisibleTiles,
    showHelpers: middle_showHelpers,
  } = useControls("middle", {
    show: true,
    debug: false,
    showHelpers: false,
  });

  const {
    show: front_show,
    debug: front_debugNextVisibleTiles,
    showHelpers: front_showHelpers,
  } = useControls("front", {
    show: true,
    debug: true,
    showHelpers: false,
  });

  const {
    show: forefront_show,
    debug: forefront_debugNextVisibleTiles,
    showHelpers: forefront_showHelpers,
  } = useControls("forefront", {
    show: true,
    debug: false,
    showHelpers: false,
  });

  return (
    <>
      <WiredBox visible={showBox} width={500} height={500} depth={500} />

      <PanControl2D
        onUpdate={setCenter}
        pixelsPerSecond={300}
        pointerDisabled
      />

      <OrbitControls />

      <Stage2D name="stage0" noAutoRender defaultCamera>
        <ParallaxProjection
          plane="xy"
          origin="bottom left"
          height={800}
          distanceToProjectionPlane={800}
          far={5000}
          fit="contain"
        />
      </Stage2D>

      <group matrix={xyTransform} matrixAutoUpdate={false} ref={rootNode}>
        <Map2DImageLayer
          name="forefront"
          matrix={forefrontTransform}
          camera={camera}
          imageUrl="/examples/assets/kastani/seamless-plants-1200px.png"
          width={1200}
          height={233}
          offsetX={-1200 / 2}
          offsetY={0}
          centerX={center.x}
          centerY={center.y}
          horizontal
          debugNextVisibleTiles={forefront_debugNextVisibleTiles}
          showHelpers={forefront_showHelpers}
          visible={forefront_show}
        />

        <Map2DImageLayer
          name="front"
          matrix={frontTransform}
          camera={camera}
          imageUrl="/examples/assets/kastani/seamless-small-blue-red-yellow-1000px.png"
          width={1000}
          height={258}
          offsetX={-1000 / 2}
          offsetY={0}
          centerX={center.x}
          centerY={center.y}
          horizontal
          debugNextVisibleTiles={front_debugNextVisibleTiles}
          showHelpers={front_showHelpers}
          visible={front_show}
        />

        <Map2DImageLayer
          name="middle"
          matrix={middleTransform}
          camera={camera}
          imageUrl="/examples/assets/kastani/skull-big-turquoise-2000px.png"
          width={2000}
          height={479}
          offsetX={-2000 / 2}
          offsetY={0}
          centerX={center.x}
          centerY={center.y}
          horizontal
          debugNextVisibleTiles={middle_debugNextVisibleTiles}
          showHelpers={middle_showHelpers}
          visible={middle_show}
        />

        <Map2DImageLayer
          name="back"
          matrix={backTransform}
          camera={camera}
          imageUrl="/examples/assets/kastani/skull-blue-2000px.png"
          width={2000}
          height={383}
          offsetX={-2000 / 2}
          offsetY={0}
          centerX={center.x}
          centerY={center.y}
          horizontal
          debugNextVisibleTiles={back_debugNextVisibleTiles}
          showHelpers={back_showHelpers}
          visible={back_show}
        />
      </group>

      <Effects>
        <shaderPass args={[SepiaShader]} uniforms-amount-value={0.2} />
        <shaderPass args={[VignetteShader]} uniforms-darkness-value={2} />
      </Effects>
    </>
  );
};
