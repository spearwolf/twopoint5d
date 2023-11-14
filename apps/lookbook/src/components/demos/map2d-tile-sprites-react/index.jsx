import {Canvas} from '@react-three/fiber';
import {StrictMode} from 'react';
import {Map2DTileSpritesDemo} from './Map2DTileSpritesDemo.jsx';

export default function DemoOrDie() {
  return (
    <Canvas dpr={[1, 2]} camera={{position: [0, 350, 500], far: 8000}}>
      <StrictMode>
        <Map2DTileSpritesDemo />
        {/* <OrbitControls autoRotate /> */}
      </StrictMode>
    </Canvas>
  );
}
