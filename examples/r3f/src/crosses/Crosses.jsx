import { extend } from "@react-three/fiber";
import { DoubleSide } from "three";
import { VertexObjectGeometry, VertexObjects } from "twopoint5d";
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
