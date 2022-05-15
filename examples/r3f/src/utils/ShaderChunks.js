import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

export const ShaderChunks = ({ chunks }) => {
  const primitiveRef = useRef({});
  const [material, setMaterial] = useState(null);

  useEffect(() => {
    if (material && typeof chunks === "object") {
      const prevChunks = Object.fromEntries(
        Object.keys(chunks).map((name) => [name, material.chunks[name]])
      );

      Object.entries(chunks).forEach(([name, value]) => {
        material.chunks[name] = value;
      });

      return () => {
        Object.entries(prevChunks).forEach(([name, value]) => {
          material.chunks[name] = value;
        });
      };
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
