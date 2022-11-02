/* eslint-disable no-console */

import {MathUtils, Shader, ShaderMaterial, ShaderMaterialParameters, WebGLRenderer} from 'three';

export interface CustomChunksShaderMaterialParameters extends ShaderMaterialParameters {}

export interface CustomShaderChunks {
  [chunkName: string]: string;
}

export class CustomChunksShaderMaterial extends ShaderMaterial {
  readonly #uuid = MathUtils.generateUUID();

  #chunksSerial = 0;

  override customProgramCacheKey(): string {
    return `${this.#uuid},${this.#chunksSerial}`;
  }

  replaceVertexShaderChunks: string[] = [];
  replaceFragmentShaderChunks: string[] = [];

  /**
   * Static _chunk objects_ define static _shader fragments_.
   * If individual properties of the chunk objects are changed,
   * the shader is not aware of this and the shader is _not_ recompiled.
   *
   * The shader is only automatically recompiled when chunks objects are set using
   * `addStaticChunks()` or `removeStaticChunks()` methods.
   *
   * Which chunk fragment with the same name has priority determines
   * the order of the chunks objects in the `staticChunks` array.
   * BUT but if chunk fragments are defined with the dynamic `chunks` object,
   * they always have priority over the static ones.
   */
  readonly staticChunks: Record<string, string>[] = [];

  addStaticChunks(chunks: Record<string, string>): () => void {
    if (this.staticChunks.indexOf(chunks) === -1) {
      this.staticChunks.push(chunks);
      ++this.#chunksSerial;
      return () => this.removeStaticChunks(chunks);
    }
    return () => void 0;
  }

  removeStaticChunks(chunks: Record<string, string>) {
    const idx = this.staticChunks.indexOf(chunks);
    if (idx !== -1) {
      ++this.#chunksSerial;
      this.staticChunks.splice(idx, 1);
    }
  }

  /**
   * The `chunks` object is *dynamic*.
   * If properties are changed here, then the shader is automatically recompiled.
   *
   * Chunks defined here as properties override static chunks.
   */
  readonly chunks: CustomShaderChunks = ((material) =>
    new Proxy(
      {},
      {
        set(target: any, propKey: string, value, receiver) {
          if (!(propKey in target) || target[propKey] !== value) {
            ++material.#chunksSerial;
            material.needsUpdate = true;

            if (value != null) {
              Reflect.set(target, propKey, value, receiver);
            } else {
              delete target[propKey];
            }

            return true;
          }
          return false;
        },

        get(target: any, propKey: string) {
          if (propKey in target) {
            return target[propKey];
          }
          return material.staticChunks.reduce<string>(
            (value, chunks) => (propKey in chunks ? chunks[propKey] : value),
            undefined,
          );
        },
      },
    ))(this);

  #customChunks(): [string, string][] {
    const chunks: Record<string, string> = {};

    [...this.staticChunks, this.chunks].forEach((staticChunks) => {
      Object.entries(staticChunks).forEach(([key, value]) => {
        chunks[key] = value;
      });
    });

    return Object.entries(chunks);
  }

  logShadersToConsole = false;

  override onBeforeCompile(shader: Shader, _renderer: WebGLRenderer): void {
    const customChunks = this.#customChunks();

    const replaceChunk = (shaderType: 'vertexShader' | 'fragmentShader') => (chunkName: string) => {
      shader[shaderType] = customChunks.reduce(
        (source, [customChunkName, customChunkValue]) => source.replace(`#include <${customChunkName}>`, customChunkValue),
        shader[shaderType].replace(`#include <${chunkName}>`, this.chunks[chunkName] ?? ''),
      );
    };

    this.replaceVertexShaderChunks.forEach(replaceChunk('vertexShader'));
    this.replaceFragmentShaderChunks.forEach(replaceChunk('fragmentShader'));

    if (this.logShadersToConsole) {
      console.groupCollapsed(`CustomChunksShaderMaterial.onBeforeCompile(), name= ${this.name ?? this.uuid}`);
      console.group('vertexShader');
      console.log(shader.vertexShader);
      console.groupEnd();
      console.group('fragmentShader');
      console.log(shader.fragmentShader);
      console.groupEnd();
      console.groupEnd();
    }
  }

  protected updateBoolDefine(name: string, value: boolean) {
    if (value) {
      Object.assign(this.defines, this.defines, {[name]: 1});
    } else if (this.defines) {
      delete this.defines[name];
    }
  }
}
