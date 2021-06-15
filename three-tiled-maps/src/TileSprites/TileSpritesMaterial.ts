import {DoubleSide, ShaderMaterial, ShaderMaterialParameters, Texture} from 'three';

const vertexShader = `
  attribute vec2 quadSize;
  attribute vec3 instancePosition;
  attribute vec4 texCoords;

  varying vec2 vTexCoords;

  void main() {
    vec4 vertexPosition = vec4(position * vec3(quadSize.x, 0.0, quadSize.y), 1.0)
                        + vec4(instancePosition, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * vertexPosition;

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

export interface TileSpritesMaterialParamters extends ShaderMaterialParameters {
  colorMap: Texture;
}

export class TileSpritesMaterial extends ShaderMaterial {
  constructor({colorMap, ...options}: TileSpritesMaterialParamters) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        colorMap: {
          value: colorMap,
        },
      },
      transparent: true,
      side: DoubleSide,
      ...options,
    });
    this.name = 'TileSpritesMaterial';
  }
}
