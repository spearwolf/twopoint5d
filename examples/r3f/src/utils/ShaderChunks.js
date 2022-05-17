import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";

export const ShaderChunks = ({ chunks }) => {
  const primitiveRef = useRef({});
  const [material, setMaterial] = useState(null);

  useEffect(() => {
    if (material && typeof chunks === "object") {
      return material.addStaticChunks(chunks);
    }
  }, [material, chunks]);

  return (
    <primitive
      object={primitiveRef.current}
      attach={(parent /*, self */) => {
        setMaterial(parent);
      }}
    />
  );
};

ShaderChunks.propTypes = {
  chunks: PropTypes.objectOf(PropTypes.string),
};
