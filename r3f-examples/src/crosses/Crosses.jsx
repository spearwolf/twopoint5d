import React from "react";
import { extend } from "@react-three/fiber";
import {
  VertexObjectGeometry,
  VertexObjects,
} from "@spearwolf/three-vertex-objects";
import { DoubleSide } from "three";
import { CrossDescriptor } from "./CrossDescriptor";

extend({ VertexObjects, VertexObjectGeometry });

export function Crosses({ capacity, color, onCreateGeometry }) {
  return (
    <vertexObjects>
      <vertexObjectGeometry
        args={[CrossDescriptor, capacity]}
        ref={onCreateGeometry}
      ></vertexObjectGeometry>
      <meshBasicMaterial color={color} side={DoubleSide}></meshBasicMaterial>
    </vertexObjects>
  );
}
