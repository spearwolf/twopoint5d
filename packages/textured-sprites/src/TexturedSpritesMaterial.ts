import {ShaderTool, unpick, CustomChunksShaderMaterial, CustomChunksShaderMaterialParameters} from '@spearwolf/vertex-objects';
import {DoubleSide, Texture} from 'three';

const vertexShader = `

  attribute vec2 quadSize;
  attribute vec3 instancePosition;
  attribute vec4 texCoords;
  attribute float rotation;

  varying vec2 vTexCoords;

  #include <extra_pars_vertex>

  ${ShaderTool.rotateZ()}

  void main() {
    vec4 vertexPosition = rotateZ(rotation)
                        * vec4(position * vec3(quadSize.xy, 0.0), 0.0)
                        + vec4(instancePosition, 1.0);

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

const fragmentDiscardByAlpha = `

  if (gl_FragColor.a == 0.0) {
    discard;
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
        colorMap: {
          value: options?.colorMap,
        },
      },
      transparent: true,
      side: DoubleSide,
      ...unpick(options, 'colorMap'),
    });

    this.name = options?.name ?? '@spearwolf/textured-sprites:TexturedSpritesMaterial';

    this.replaceVertexShaderChunks = ['extra_pars_vertex', 'post_main_vertex'];
    this.replaceFragmentShaderChunks = ['extra_pars_fragment', 'discard_by_alpha_fragment', 'post_main_fragment'];

    this.chunks.discard_by_alpha_fragment = fragmentDiscardByAlpha;
  }

  get colorMap(): Texture | undefined {
    return this.uniforms.colorMap.value;
  }

  set colorMap(colorMap: Texture | undefined) {
    this.uniforms.colorMap.value = colorMap;
  }
}
