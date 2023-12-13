import {OrbitControls} from '@react-three/drei';
import {Canvas} from '@react-three/fiber';
import {StrictMode} from 'react';
import {DemoOrDie} from './DemoOrDie.jsx';

export default function main() {
  return (
    <Canvas linear flat dpr={[1, 2]} camera={{position: [0, 0, 50]}}>
      <StrictMode>
        <DemoOrDie capacity={500} />
        <OrbitControls />
      </StrictMode>
    </Canvas>
  );
}
