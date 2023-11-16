import {DoubleSide, Texture} from 'three';
import {CustomChunksShaderMaterial, type CustomChunksShaderMaterialParameters} from '../texture/CustomChunksShaderMaterial.js';
import {unpick} from '../utils/unpick.js';
import ShaderLib from './ShaderLib.js';

const vertexShader = `

  attribute vec2 quadSize;
  attribute vec3 instancePosition;
  attribute vec4 texCoords;
  attribute float rotation;

  varying vec2 vTexCoords;

  #include <extra_pars_vertex>

  #include <rotateZ_vertex>

  #ifdef RENDER_AS_BILLBOARDS
  #include <makeBillboard_fn_vertex>
  #endif

  void main() {

    #ifdef RENDER_AS_BILLBOARDS
    #include <vertexPosition_makeBillboard_instanced_vertex>
    #else
    #include <vertexPosition_instanced_vertex>
    #endif

    #include <after_vertexPosition_vertex>

    gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPosition.xyz, 1.0);

    vTexCoords = texCoords.xy + (uv * texCoords.zw);

    #include <post_main_vertex>
  }

`;

const fragmentShader = `

  uniform sampler2D colorMap;

  varying vec2 vTexCoords;

  #include <extra_pars_fragment>

  void main() {
    gl_FragColor = texture2D(colorMap, vTexCoords);

    #include <discard_by_alpha_fragment>
    #include <post_main_fragment>
  }

`;

interface TexturedSpritesMaterialParameters extends CustomChunksShaderMaterialParameters {
  colorMap?: Texture;
}

export class TexturedSpritesMaterial extends CustomChunksShaderMaterial {
  constructor(options?: TexturedSpritesMaterialParameters) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        ...options?.uniforms,
        colorMap: {
          value: options?.colorMap,
        },
      },
      transparent: true,
      side: DoubleSide,
      ...unpick(options, 'colorMap', 'uniforms'),
    });

    this.name = options?.name ?? 'twopoint5d.TexturedSpritesMaterial';

    this.replaceVertexShaderChunks = [
      'extra_pars_vertex',
      'rotateZ_vertex',
      'makeBillboard_fn_vertex',
      'vertexPosition_makeBillboard_instanced_vertex',
      'vertexPosition_instanced_vertex',
      'after_vertexPosition_vertex',
      'post_main_vertex',
    ];

    this.replaceFragmentShaderChunks = ['extra_pars_fragment', 'discard_by_alpha_fragment', 'post_main_fragment'];

    this.addStaticChunks(ShaderLib);
  }

  get colorMap(): Texture | undefined {
    return this.uniforms['colorMap'].value;
  }

  set colorMap(colorMap: Texture | undefined) {
    if (this.uniforms['colorMap'].value !== colorMap) {
      this.uniforms['colorMap'].value = colorMap;
      this.uniformsNeedUpdate = true;
    }
  }

  get renderAsBillboards(): boolean {
    return this.defines?.['RENDER_AS_BILLBOARDS'] === 1;
  }

  set renderAsBillboards(renderAsBillboards: boolean) {
    this.updateBoolDefine('RENDER_AS_BILLBOARDS', renderAsBillboards);
  }
}
