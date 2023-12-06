import {TexturedSpritesMaterial, type TexturedSpritesMaterialParameters} from '@spearwolf/twopoint5d';
import {Color, Vector2, Vector4} from 'three';

const StarShader = {
  /*
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

    ...
  }
  */
  /*
    vec4 vertexPosition = vec4(position * vec3(quadSize.xy, 0.0), 0.0)
                        + vec4(instancePosition, 1.0);
  */
  extra_pars_vertex: `
  
    #define PI 3.1415926538

    uniform float[2] screenResolution;
    uniform float[2] minMaxSizeScale;
    uniform vec2 nearFar;
    uniform float cameraLineOfSightEscape;

    varying float vDepth;

  `,
  vertexPosition_instanced_vertex: `

    vec4 vertexPosition = vec4(instancePosition, 1.0);

  `,
  post_main_vertex: `

    vec2 scaleToPixel = vec2(4.0 / screenResolution[0] * gl_Position.w, 4.0 / screenResolution[1] * gl_Position.w);

    float z = -(modelViewMatrix * vec4(instancePosition.xyz, 1.0)).z;
    vDepth = 1.0 - clamp((z - nearFar.x) / (nearFar.y - nearFar.x), 0.0, 1.0);

    vec2 minSize = vec2(quadSize.x * minMaxSizeScale[0], quadSize.y * minMaxSizeScale[0]);
    vec2 maxSize = vec2(quadSize.y * minMaxSizeScale[1], quadSize.y * minMaxSizeScale[1]);
    vec2 size = mix(minSize, maxSize, vDepth);
    
    gl_Position.x += position.x * scaleToPixel.x * size.x;
    gl_Position.y += position.y * scaleToPixel.y * size.y;

    float f = cameraLineOfSightEscape * 2.0 * (0.5 - (sin((PI * 0.5) + (vDepth * PI * 0.5)) * 0.5));
    gl_Position.x += f * gl_Position.x;
    gl_Position.y += f * gl_Position.y;
  `,
  /*
  #include <after_vertexPosition_vertex>

  gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPosition.xyz, 1.0);

  vTexCoords = texCoords.xy + (uv * texCoords.zw);

  #include <post_main_vertex>
  */
  // ---------------------------------------------------------------------------------------
  /*  

  uniform sampler2D colorMap;

  varying vec2 vTexCoords;

  #include <extra_pars_fragment>

  void main() {
    gl_FragColor = texture2D(colorMap, vTexCoords);

    #include <discard_by_alpha_fragment>
    #include <post_main_fragment>
  }
  */
  extra_pars_fragment: `

    uniform vec4 tintColorNear;
    uniform vec4 tintColorFar;

    varying float vDepth;

  `,
  post_main_fragment: `

    gl_FragColor.xyz = mix(tintColorFar.xyz, tintColorNear.xyz, vDepth);

  `,
};

export interface StarMaterialParameters extends TexturedSpritesMaterialParameters {
  tintColorNear?: Color;
  tintColorFar?: Color;
  logShadersToConsole?: boolean;
}

export class StarMaterial extends TexturedSpritesMaterial {
  constructor(options: StarMaterialParameters) {
    super({
      ...options,
      name: 'twopoint5d.demos.StarMaterial',
      uniforms: {
        ...options?.uniforms,
        colorMap: {
          value: options?.colorMap,
        },
        screenResolution: {
          value: [0, 0],
        },
        minMaxSizeScale: {
          value: [1, 1],
        },
        nearFar: {
          value: new Vector2(0, 1),
        },
        tintColorNear: {
          value: new Vector4(1, 1, 1, 1),
        },
        tintColorFar: {
          value: new Vector4(1, 1, 1, 1),
        },
        cameraLineOfSightEscape: {
          value: 2,
        },
      },
    });

    this.addStaticChunks(StarShader);

    if (typeof options?.logShadersToConsole === 'boolean') {
      this.logShadersToConsole = options.logShadersToConsole;
    }

    if (options?.tintColorNear) {
      this.tintColorNear = options.tintColorNear;
    }

    if (options?.tintColorFar) {
      this.tintColorFar = options.tintColorFar;
    }
  }

  get cameraLineOfSightEscape(): number {
    return this.uniforms['cameraLineOfSightEscape'].value;
  }

  set cameraLineOfSightEscape(value: number) {
    if (this.uniforms['cameraLineOfSightEscape'].value !== value) {
      this.uniforms['cameraLineOfSightEscape'].value = value;
      this.uniformsNeedUpdate = true;
    }
  }

  get nearFar(): Vector2 {
    return this.uniforms['nearFar'].value;
  }

  set nearFar(value: Vector2) {
    if (!this.nearFar.equals(value)) {
      this.uniforms['nearFar'].value = value.clone();
      this.uniformsNeedUpdate = true;
    }
  }

  setNearFar(near: number, far: number) {
    this.uniforms['nearFar'].value = new Vector2(near, far);
    this.uniformsNeedUpdate = true;
  }

  readonly #tintColorNear: Color = new Color(1, 1, 1);
  readonly #tintColorFar: Color = new Color(1, 1, 1);

  get tintColorNear(): Color {
    return this.#tintColorNear;
  }

  set tintColorNear(value: Color) {
    if (!this.#tintColorNear.equals(value)) {
      this.#tintColorNear.copy(value);
      this.uniforms['tintColorNear'].value = new Vector4(...this.#tintColorNear.toArray(), 1);
      this.uniformsNeedUpdate = true;
    }
  }

  get tintColorFar(): Color {
    return this.#tintColorFar;
  }

  set tintColorFar(value: Color) {
    if (!this.#tintColorFar.equals(value)) {
      this.#tintColorFar.copy(value);
      this.uniforms['tintColorFar'].value = new Vector4(...this.#tintColorFar.toArray(), 1);
      this.uniformsNeedUpdate = true;
    }
  }

  get screenResolution(): [number, number] {
    return this.uniforms['screenResolution'].value;
  }

  set screenResolution(value: [number, number]) {
    const current = this.uniforms['screenResolution'].value;
    if (current[0] !== value[0] || current[1] !== value[1]) {
      this.uniforms['screenResolution'].value = value.splice(0);
      this.uniformsNeedUpdate = true;
    }
  }

  setScreenResolution(width: number, height: number) {
    this.uniforms['screenResolution'].value = [width, height];
    this.uniformsNeedUpdate = true;
  }

  get minMaxSizeScale(): [number, number] {
    return this.uniforms['minMaxSizeScale'].value;
  }

  set minMaxSizeScale(value: [number, number]) {
    const current = this.uniforms['minMaxSizeScale'].value;
    if (current[0] !== value[0] || current[1] !== value[1]) {
      this.uniforms['minMaxSizeScale'].value = value.splice(0);
      this.uniformsNeedUpdate = true;
    }
  }

  setMinMaxSizeScale(minSizeScale: number, maxSizeScale: number) {
    this.uniforms['minMaxSizeScale'].value = [minSizeScale, maxSizeScale];
    this.uniformsNeedUpdate = true;
  }
}
