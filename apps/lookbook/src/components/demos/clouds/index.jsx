import {OrbitControls} from '@react-three/drei';
import {Canvas} from '@react-three/fiber';
import {ParallaxProjection, Stage2D} from '@spearwolf/twopoint5d-r3f';
import {useControls} from 'leva';

import {Clouds} from './Clouds.jsx';

const Demo = ({speed, alpha}) => (
  <>
    <Stage2D name="stage1" defaultCamera renderPriority={1}>
      <ParallaxProjection
        plane="xy"
        origin="bottom left"
        width={1024}
        height={768}
        distanceToProjectionPlane={1500}
        fit="contain"
      />

      <Clouds
        capacity={400}
        gap={20}
        speed={speed}
        width={3500}
        height={600}
        yOffset={-1750}
        zOffset={-15000}
        fadeInRange={0.3}
        fadeOutRange={0.3}
        postAlphaMultiplier={alpha}
      />
    </Stage2D>

    <OrbitControls />
  </>
);

export default function DemoOrDie() {
  const {speed, alpha} = useControls({
    speed: {value: 1300, min: 0, max: 5000, step: 1},
    alpha: {value: 0.23, min: 0.01, max: 0.99, step: 0.01},
  });

  return (
    <Canvas dpr={[1, 2]} camera={{position: [0, 0, 50]}}>
      <Demo speed={speed} alpha={alpha} />
    </Canvas>
  );
}
