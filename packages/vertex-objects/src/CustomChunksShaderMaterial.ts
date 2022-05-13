import {MathUtils, Shader, ShaderMaterial, ShaderMaterialParameters, WebGLRenderer} from 'three';

export interface CustomChunksShaderMaterialParameters extends ShaderMaterialParameters {}

export interface CustomShaderChunks {
  [chunkName: string]: string;
}

export class CustomChunksShaderMaterial extends ShaderMaterial {
  readonly #uuid = MathUtils.generateUUID();

  #version = 0;

  replaceVertexShaderChunks: string[] = [];
  replaceFragmentShaderChunks: string[] = [];

  customProgramCacheKey(): string {
    return `${this.#uuid},${this.#version},${this.replaceVertexShaderChunks.concat(this.replaceFragmentShaderChunks).join(',')}`;
  }

  readonly chunks: CustomShaderChunks = ((material) =>
    new Proxy(
      {},
      {
        set(target: any, propKey: string, value, receiver) {
          if (!(propKey in target) || target[propKey] !== value) {
            ++material.#version;

            if (
              material.replaceVertexShaderChunks.indexOf(propKey) !== -1 ||
              material.replaceFragmentShaderChunks.indexOf(propKey) !== -1
            ) {
              material.needsUpdate = true;
            }

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

  onBeforeCompile(shader: Shader, _renderer: WebGLRenderer): void {
    const replaceChunk = (shaderType: 'vertexShader' | 'fragmentShader') => (chunkName: string) => {
      shader[shaderType] = shader[shaderType].replace(`#include <${chunkName}>`, this.chunks[chunkName] ?? '');
    };

    this.replaceVertexShaderChunks.forEach(replaceChunk('vertexShader'));
    this.replaceFragmentShaderChunks.forEach(replaceChunk('fragmentShader'));
  }
}
