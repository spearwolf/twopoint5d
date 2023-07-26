import {Canvas} from '@react-three/fiber';
import {Leva} from 'leva';
import {StrictMode} from 'react';

import {Map2DRectVisiAreaDemo} from './Map2DRectVisiAreaDemo.jsx';
import {SwitchCameraUI} from './SwitchCameraUI.jsx';

export default function DemoOrDie() {
  return (
    <>
      <Leva titleBar />
      <SwitchCameraUI />
      <Canvas dpr={[1, 2]} camera={{position: [100, 350, 600], far: 25000}}>
        <StrictMode>
          <Map2DRectVisiAreaDemo />
        </StrictMode>
      </Canvas>
    </>
  );
}
