import {DoubleSide, Texture} from 'three';

import {CustomChunksShaderMaterial, CustomChunksShaderMaterialParameters, unpick} from '../vertexObjects';
import ShaderLib from './ShaderLib';

const vertexShader = `
  attribute vec2 quadSize;
  attribute vec3 instancePosition;
  attribute float rotation;

  attribute float animId;
  attribute float animOffset;

  uniform sampler2D animsMap;
  uniform vec2 animsMapSize;
  uniform float time;

  varying vec2 vTexCoords;

  #include <extra_pars_vertex>

  #include <rotateZ_vertex>

  vec2 texCoordsFromIndex(in vec2 mapSize, in int ndx) {
    int column = int(mod(float(ndx), float(mapSize[0])));
    int row = ndx / int(mapSize[0]);
    return (vec2(column, row) + 0.5) / vec2(mapSize[0], mapSize[1]);
  }

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

    // ---- texture coords from frame based animations meta data ---------------
    vec4 animMetaData = texture2D(animsMap, texCoordsFromIndex(animsMapSize, int(animId)));
    int frameIndex = int(floor(mod((time + animOffset) / animMetaData.y * animMetaData.x, animMetaData.x)));
    vec4 texCoords = texture2D(animsMap, texCoordsFromIndex(animsMapSize, int(animMetaData.z) + frameIndex));

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

interface AnimatedSpritesMaterialParameters extends CustomChunksShaderMaterialParameters {
  colorMap?: Texture;
  animsMap?: Texture;
  time?: number;
}

export class AnimatedSpritesMaterial extends CustomChunksShaderMaterial {
  constructor(options?: AnimatedSpritesMaterialParameters) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        ...options?.uniforms,
        colorMap: {
          value: options?.colorMap,
        },
        animsMap: {
          value: options?.animsMap,
        },
        animsMapSize: {
          value: [options?.animsMap?.image.width ?? 0, options?.animsMap?.image.height ?? 0],
        },
        time: {
          value: 0,
        },
      },
      transparent: true,
      side: DoubleSide,
      ...unpick(options ?? {}, 'uniforms', 'colorMap', 'animsMap', 'time'),
    });

    this.name = options?.name ?? 'twopoint5d.AnimatedSpritesMaterial';

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
    this.uniforms['colorMap'].value = colorMap;
  }

  get animsMap(): Texture | undefined {
    return this.uniforms['animsMap'].value;
  }

  set animsMap(animsMap: Texture | undefined) {
    this.uniforms['animsMap'].value = animsMap;
    this.uniforms['animsMapSize'].value = animsMap ? [animsMap.image.width, animsMap.image.height] : [0, 0];
  }

  get renderAsBillboards(): boolean {
    return this.defines?.['RENDER_AS_BILLBOARDS'] === 1;
  }

  set renderAsBillboards(renderAsBillboards: boolean) {
    this.updateBoolDefine('RENDER_AS_BILLBOARDS', renderAsBillboards);
  }
}
