import {CustomChunksShaderMaterial} from '@spearwolf/twopoint5d';
import {useEffect, useRef, useState} from 'react';

export interface ShaderChunksProps {
  chunks: Record<string, string>;
}

export function ShaderChunks({chunks}: ShaderChunksProps) {
  const primitiveRef = useRef({});
  const [material, setMaterial] = useState<CustomChunksShaderMaterial | null>(null);

  useEffect(() => {
    if (material && typeof chunks === 'object') {
      return material.addStaticChunks(chunks);
    }
  }, [material, chunks]);

  return (
    <primitive
      object={primitiveRef.current}
      attach={(parent: CustomChunksShaderMaterial /*, self */) => {
        setMaterial(parent);
      }}
    />
  );
}

ShaderChunks.displayName = 'ShaderChunks';
