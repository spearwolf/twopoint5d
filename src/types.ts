export type VertexAttributeDataType = 'float32' | 'float64';
export type VertexAttributeUsageType = 'static' | 'dynamic' | 'stream';

export interface VertexAttributeByComponents {
  components: string[];
}

export interface VertexAttributeBySize {
  size: number;
}

export interface VertexAttributeBaseDescription {
  type: VertexAttributeDataType;
  usage: VertexAttributeUsageType;
}

export type VertexAttributeDescription = VertexAttributeBaseDescription &
  (VertexAttributeByComponents | VertexAttributeBySize);

export interface InstancedVertexAttributeBaseDescription
  extends VertexAttributeBaseDescription {
  meshCount?: number;
}

export type InstancedVertexAttributeDescription =
  | InstancedVertexAttributeBaseDescription
  | (VertexAttributeByComponents & VertexAttributeBySize);

export type VertexAttributesType = Record<string, VertexAttributeDescription>;

export type InstancedVertexAttributesType = Record<
  string,
  InstancedVertexAttributeDescription
>;

export interface VertexObjectDescription {
  vertexCount: number;
  indices?: number[];
  attributes: VertexAttributesType;
}

export interface InstancedVertexObjectDescription {
  meshCount: number;
  attributes: InstancedVertexAttributesType;
}
