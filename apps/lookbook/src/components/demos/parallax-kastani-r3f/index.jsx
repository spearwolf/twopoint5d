import {Canvas} from '@react-three/fiber';
import {Leva} from 'leva';
import {Perf} from 'r3f-perf';
import {StrictMode} from 'react';

import {CrossHair} from '../CrossHair.jsx';
import {Map2DCoords} from '../Map2DCoords.jsx';
import {DemoOrDie as Main} from './parallax-kastani.jsx';

export default function DemoOrDie() {
  return (
    <>
      <Leva titleBar collapsed />
      <Canvas dpr={[1, 2]} camera={{position: [100, 350, 600], far: 25000}}>
        <StrictMode>
          <Main />
        </StrictMode>
        <Perf position="top-left" style={{transform: 'scale(1)'}} />
      </Canvas>
      <CrossHair />
      <Map2DCoords />
    </>
  );
}
