import {ShaderTool, unpick} from '@spearwolf/vertex-objects';
import {DoubleSide, ShaderMaterial, ShaderMaterialParameters, Texture} from 'three';

const vertexShader = `
  attribute vec2 quadSize;
  attribute vec3 instancePosition;
  attribute vec4 texCoords;
  attribute float rotation;

  varying vec2 vTexCoords;

  ${ShaderTool.rotateZ()}

  void main() {
    vec4 vertexPosition = rotateZ(rotation)
                        * vec4(position * vec3(quadSize.xy, 0.0), 0.0)
                        + vec4(instancePosition, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPosition.xyz, 1.0);

    vTexCoords = texCoords.xy + (uv * texCoords.zw);
  }
`;

const fragmentShader = `
  uniform sampler2D colorMap;

  varying vec2 vTexCoords;

  void main() {
    gl_FragColor = texture2D(colorMap, vTexCoords);

    if (gl_FragColor.a == 0.0) {
      discard;
    }
  }
`;

interface TexturedSpritesMaterialParameters extends ShaderMaterialParameters {
  colorMap?: Texture;
}

export class TexturedSpritesMaterial extends ShaderMaterial {
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
  }

  get colorMap(): Texture | undefined {
    return this.uniforms.colorMap.value;
  }

  set colorMap(colorMap: Texture | undefined) {
    this.uniforms.colorMap.value = colorMap;
  }
}
