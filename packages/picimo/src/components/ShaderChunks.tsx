import {CustomChunksShaderMaterial} from '@spearwolf/vertex-objects';
import {useEffect, useRef, useState} from 'react';

export interface ShaderChunksProps {
  chunks: Record<string, string>;
}

export function ShaderChunks({chunks}: ShaderChunksProps) {
  const primitiveRef = useRef({});
  const [material, setMaterial] = useState<CustomChunksShaderMaterial>(null);

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
