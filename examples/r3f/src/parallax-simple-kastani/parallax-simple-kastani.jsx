import { Effects, OrbitControls } from "@react-three/drei";
import { extend, useThree } from "@react-three/fiber";
import { useState } from "react";
import { CameraHelper, Euler, MathUtils, Matrix4 } from "three";
import { CameraBasedVisibility } from "twopoint5d";
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
  horizontal = false,
  vertical = false,
  matrix = new Matrix4(),
}) => {
  return (
    <>
      <TileSet
        name={name}
        url={imageUrl}
        tileWidth={width}
        tileHeight={height}
      />

      <Map2DLayer3D
        name="Map2DLayer3D"
        matrix={matrix}
        matrixAutoUpdate={false}
        tileWidth={width}
        tileHeight={height}
        xOffset={offsetX}
        yOffset={offsetY}
        centerX={centerX}
        centerY={centerY}
        updateOnFrame
      >
        <cameraBasedVisibility
          camera={camera}
          lookAtCenter={false}
          depth={10}
          attach="visibilitor"
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

const forefrontTransform = new Matrix4().multiplyMatrices(
  new Matrix4().makeRotationFromEuler(new Euler(MathUtils.degToRad(90), 0, 0)),
  new Matrix4().makeTranslation(0, 225, -200)
);

const frontTransform = new Matrix4().multiplyMatrices(
  new Matrix4().makeRotationFromEuler(new Euler(MathUtils.degToRad(90), 0, 0)),
  new Matrix4().makeTranslation(0, 270, -100)
);

const middleTransform = new Matrix4().multiplyMatrices(
  new Matrix4().makeRotationFromEuler(new Euler(MathUtils.degToRad(90), 0, 0)),
  new Matrix4().makeTranslation(0, 90, 0)
);

const backTransform = new Matrix4().multiplyMatrices(
  new Matrix4().makeRotationFromEuler(new Euler(MathUtils.degToRad(90), 0, 0)),
  new Matrix4().makeTranslation(0, -180, 150)
);

export const DemoOrDie = () => {
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const camera = useThree((state) => state.camera);

  return (
    <>
      <WiredBox width={437} height={437} depth={437} />

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
          height={600}
          distanceToProjectionPlane={800}
          far={5000}
          fit="contain"
        />
      </Stage2D>

      <Map2DImageLayer
        name="forefront"
        matrix={forefrontTransform}
        camera={camera}
        imageUrl="/examples/assets/kastani/seamless-plants-1200px.png"
        width={1200}
        height={233}
        offsetX={-1200 / 2}
        offsetY={-233 / 2}
        centerX={center.x}
        centerY={center.y}
        horizontal
      />

      <Map2DImageLayer
        name="front"
        matrix={frontTransform}
        camera={camera}
        imageUrl="/examples/assets/kastani/seamless-small-blue-red-yellow-1000px.png"
        width={1000}
        height={258}
        offsetX={-1000 / 2}
        offsetY={-258 / 2}
        centerX={center.x}
        centerY={center.y}
        horizontal
      />

      <Map2DImageLayer
        name="middle"
        matrix={middleTransform}
        camera={camera}
        imageUrl="/examples/assets/kastani/skull-big-turquoise-2000px.png"
        width={2000}
        height={479}
        offsetX={-2000 / 2}
        offsetY={-479 / 2}
        centerX={center.x}
        centerY={center.y}
        horizontal
      />

      <Map2DImageLayer
        name="back"
        matrix={backTransform}
        camera={camera}
        imageUrl="/examples/assets/kastani/skull-blue-2000px.png"
        width={2000}
        height={383}
        offsetX={-2000 / 2}
        offsetY={-383 / 2}
        centerX={center.x}
        centerY={center.y}
        horizontal
      />

      <Effects>
        <shaderPass args={[SepiaShader]} uniforms-amount-value={0.2} />
        <shaderPass args={[VignetteShader]} uniforms-darkness-value={2} />
      </Effects>
    </>
  );
};
