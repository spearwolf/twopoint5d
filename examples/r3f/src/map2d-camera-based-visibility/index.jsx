import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { Perf } from "r3f-perf";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import styled from "styled-components";

import { CrossHair } from "../utils/CrossHair";
import { DemoOrDie } from "./map2d-camera-based-visibility";
import { SwitchCameraUI } from "./SwitchCameraUI";

const root = createRoot(document.getElementById("root"));

const Map2DCoordsContainer = styled.section`
  position: fixed;
  left: 2rem;
  bottom: 4rem;
`;

const Map2DCoordsText = styled.div`
  border: 1px solid #fff;
  color: #fff;
  font-size: 1.5rem;
  font-weight: bold;
`;

const Map2DCoords = () => (
  <Map2DCoordsContainer>
    <Map2DCoordsText>
      <span className="map2dCoords" />
    </Map2DCoordsText>
  </Map2DCoordsContainer>
);

root.render(
  <>
    <Leva titleBar />
    <SwitchCameraUI />
    <Canvas dpr={[1, 2]} camera={{ position: [100, 350, 600], far: 25000 }}>
      <StrictMode>
        <DemoOrDie />
      </StrictMode>
      <Perf position="top-left" style={{ transform: "scale(0.8)" }} />
    </Canvas>
    <CrossHair />
    <Map2DCoords />
  </>
);
