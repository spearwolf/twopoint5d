import {Canvas} from '@react-three/fiber';
import {StrictMode} from 'react';
import {DemoOrDie} from './DemoOrDie.jsx';

export default function main() {
  return (
    <Canvas dpr={[1, 2]} camera={{position: [0, 350, 500], far: 8000}}>
      <StrictMode>
        <DemoOrDie />
      </StrictMode>
    </Canvas>
  );
}
