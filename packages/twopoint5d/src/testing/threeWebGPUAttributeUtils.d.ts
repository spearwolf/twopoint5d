// three ships no types for its WebGPU backend utilities; this declares what
// `threeVertexLayout.spec.ts` calls, and nothing outside `src/testing/` and the specs sees it.

declare module 'three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js' {
  import type {BufferAttribute, InterleavedBufferAttribute} from 'three/webgpu';

  export default class WebGPUAttributeUtils {
    constructor(backend: unknown);

    createAttribute(attribute: BufferAttribute | InterleavedBufferAttribute, usage: number): void;

    _getVertexFormat(attribute: BufferAttribute | InterleavedBufferAttribute): string | undefined;
  }
}
