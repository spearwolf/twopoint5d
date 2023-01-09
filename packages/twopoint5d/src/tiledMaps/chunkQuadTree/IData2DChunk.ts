interface IData2DChunkDimension {
  x: number;
  y: number;

  height: number;
  width: number;
}

export interface IStringData2DChunk extends IData2DChunkDimension {
  data: string;
  compression?: string;
}

export interface IUint32Data2DChunk extends IData2DChunkDimension {
  uint32Arr: Uint32Array;
}

export type IData2DChunk = IStringData2DChunk | IUint32Data2DChunk;
