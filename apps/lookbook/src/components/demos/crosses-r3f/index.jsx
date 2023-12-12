import {OrbitControls} from '@react-three/drei';
import {Canvas} from '@react-three/fiber';
import {Crosses} from './Crosses.jsx';

const makeCrosses = (geometry) => {
  console.log('vertexObjectGeometry', geometry);

  const size = 3;
  const offset = 1.2;
  const {capacity} = geometry.pool;

  for (let i = 0; i < capacity; i++) {
    const cross = geometry.pool.createVO();
    cross.make(size, size);
    cross.rotate(i * 45);
    cross.translate(i * size * offset - ((capacity - 1) * size * offset) / 2, 0);
  }
};

function Demo() {
  return (
    <>
      <OrbitControls />
      <Crosses capacity={10} color={0xdd0033} onCreateGeometry={makeCrosses}></Crosses>
    </>
  );
}

export default function DemoOrDie() {
  return (
    <Canvas dpr={[1, 2]}>
      <Demo />
    </Canvas>
  );
}
