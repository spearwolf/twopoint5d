/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {DoubleSide, ShaderMaterial} from 'three';
// eslint-disable-next-line import/no-unresolved
import {ShaderTool} from 'three-vertex-objects';

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

export class TexturedSpritesMaterial extends ShaderMaterial {
  constructor({colorMap, ...options}) {
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
    this.name = 'TexturedSpritesMaterial';
  }
}
