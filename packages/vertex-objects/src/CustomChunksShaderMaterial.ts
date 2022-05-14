import {MathUtils, Shader, ShaderMaterial, ShaderMaterialParameters, WebGLRenderer} from 'three';

export interface CustomChunksShaderMaterialParameters extends ShaderMaterialParameters {}

export interface CustomShaderChunks {
  [chunkName: string]: string;
}

export class CustomChunksShaderMaterial extends ShaderMaterial {
  readonly #uuid = MathUtils.generateUUID();

  #chunksSerial = 0;

  customProgramCacheKey(): string {
    return `${this.#uuid},${this.#chunksSerial}`;
  }

  replaceVertexShaderChunks: string[] = [];
  replaceFragmentShaderChunks: string[] = [];

  readonly chunks: CustomShaderChunks = ((material) =>
    new Proxy(
      {},
      {
        set(target: any, propKey: string, value, receiver) {
          if (!(propKey in target) || target[propKey] !== value) {
            ++material.#chunksSerial;
            material.needsUpdate = true;

            if (value) {
              Reflect.set(target, propKey, value, receiver);
            } else {
              delete target[propKey];
            }

            return true;
          }
          return false;
        },
      },
    ))(this);

  #customChunks(): [string, string][] {
    return Object.entries(this.chunks).filter(
      ([name]) => this.replaceVertexShaderChunks.indexOf(name) === -1 && this.replaceFragmentShaderChunks.indexOf(name) === -1,
    );
  }

  onBeforeCompile(shader: Shader, _renderer: WebGLRenderer): void {
    const customChunks = this.#customChunks();

    const replaceChunk = (shaderType: 'vertexShader' | 'fragmentShader') => (chunkName: string) => {
      shader[shaderType] = customChunks.reduce(
        (source, [customChunkName, customChunkValue]) => source.replace(`#include <${customChunkName}>`, customChunkValue),
        shader[shaderType].replace(`#include <${chunkName}>`, this.chunks[chunkName] ?? ''),
      );
    };

    this.replaceVertexShaderChunks.forEach(replaceChunk('vertexShader'));
    this.replaceFragmentShaderChunks.forEach(replaceChunk('fragmentShader'));
  }
}
