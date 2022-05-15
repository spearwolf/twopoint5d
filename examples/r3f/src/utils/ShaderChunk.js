import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

export const ShaderChunk = ({ name, value, children }) => {
  const primitiveRef = useRef({});
  const [material, setMaterial] = useState(null);

  useEffect(() => {
    if (material && name) {
      const prevChunkValue = material.chunks[name];

      material.chunks[name] = value ?? children;

      return () => {
        material.chunks[name] =
          typeof prevChunkValue === "string" ? prevChunkValue : undefined;
      };
    }
  }, [material, name, value, children]);

  return (
    <primitive
      object={primitiveRef.current}
      attach={(parent /*, self */) => {
        setMaterial(parent);
      }}
    />
  );
};

ShaderChunk.propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.string,
  children: PropTypes.string,
};
