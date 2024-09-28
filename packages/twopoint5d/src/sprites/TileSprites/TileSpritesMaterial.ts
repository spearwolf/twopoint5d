import {FrontSide, ShaderMaterial, Texture, Vector4, type ShaderMaterialParameters} from 'three';

const vertexShader = `
  attribute vec2 quadSize;
  attribute vec3 instancePosition;
  attribute vec4 texCoords;

  varying vec2 vTexCoords;

  varying float fogDepth;

  void main() {
    vec4 vertexPosition = vec4(position * vec3(quadSize.x, 0.0, quadSize.y), 0.0)
                        + vec4(instancePosition, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * vertexPosition;

    vTexCoords = texCoords.xy + (uv * texCoords.zw);

    fogDepth = -(modelViewMatrix * vertexPosition).z;
  }
`;

const fragmentShader = `
  uniform sampler2D colorMap;

  uniform vec4 fogColor;
  uniform float[2] fogNearFar;

  varying vec2 vTexCoords;

  varying float fogDepth;

  void main() {
    vec4 baseColor = texture2D(colorMap, vTexCoords);

    if (baseColor.a == 0.0) {
      discard;
    }

    float fogAmount = smoothstep(fogNearFar[0], fogNearFar[1], fogDepth);
    gl_FragColor = mix(baseColor, fogColor, fogAmount);

    if (gl_FragColor.a == 0.0) {
      discard;
    }
  }
`;

export interface TileSpritesMaterialParameters extends ShaderMaterialParameters {
  colorMap?: Texture;
}

export class TileSpritesMaterial extends ShaderMaterial {
  constructor({colorMap, ...options}: TileSpritesMaterialParameters = {}) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        colorMap: {
          value: colorMap,
        },
        fogColor: {
          value: new Vector4(0.3, 0.3, 0.5, 1),
        },
        fogNearFar: {
          value: [100, 5000],
        },
      },
      transparent: true,
      side: FrontSide,
      ...options,
    });

    this.name = 'twopoint5d.TileSpritesMaterial';
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

  get fogNear(): number {
    return this.uniforms['fogNearFar'].value[0];
  }

  set fogNear(value: number) {
    if (this.uniforms['fogNearFar'].value[0] !== value) {
      this.uniforms['fogNearFar'].value[0] = value;
      this.uniformsNeedUpdate = true;
    }
  }

  get fogFar(): number {
    return this.uniforms['fogNearFar'].value[1];
  }

  set fogFar(value: number) {
    if (this.uniforms['fogNearFar'].value[1] !== value) {
      this.uniforms['fogNearFar'].value[1] = value;
      this.uniformsNeedUpdate = true;
    }
  }

  get fogColor(): Vector4 {
    return this.uniforms['fogColor'].value;
  }

  set fogColor(color: Vector4) {
    this.uniforms['fogColor'].value.copy(color);
    this.uniformsNeedUpdate = true;
  }
}
