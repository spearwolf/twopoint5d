import { OrbitControls } from "@react-three/drei";
import { extend, useThree } from "@react-three/fiber";
import { useState } from "react";
import { CameraHelper } from "three";
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

extend({ CameraBasedVisibility, CameraHelper });

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
          <TileSpritesMaterial>
            <TextureRef name={name} attach="colorMap" />
          </TileSpritesMaterial>
        </Map2DTileSprites>
      </Map2DLayer3D>
    </>
  );
};

export const DemoOrDie = () => {
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const camera = useThree((state) => state.camera);

  return (
    <>
      <PanControl2D
        onUpdate={setCenter}
        pixelsPerSecond={300}
        pointerDisabled
      />

      <OrbitControls />

      <Stage2D noAutoRender defaultCamera>
        <ParallaxProjection
          plane="xz"
          origin="top left"
          width={1000}
          height={600}
          far={5000}
          fit="contain"
        />
      </Stage2D>

      <Map2DImageLayer
        name="first"
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

      <Map2DImageLayer
        name="second"
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
    </>
  );
};
