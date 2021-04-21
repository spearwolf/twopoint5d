// === vertex attribute descriptions === ------------------ --- --  -   -

export type VertexAttributeDataType = 'float32' | 'float64';
export type VertexAttributeUsageType = 'static' | 'dynamic' | 'stream';

export interface VADescription {
  type: VertexAttributeDataType;
  usage: VertexAttributeUsageType;
}

export interface VAComponentsDescription extends VADescription {
  components: string[];
}

export interface VASizeDescription extends VADescription {
  size: number;
}

export type VertexAttributeDescription =
  | VAComponentsDescription
  | VASizeDescription;

export type VertexAttributesType = Record<string, VertexAttributeDescription>;

// === vertex object description === ------------------ --- --  -   -

export interface VertexObjectDescription {
  vertexCount?: number;
  indices?: number[];
  meshCount?: number;
  attributes: VertexAttributesType;
  // TODO methods
}
