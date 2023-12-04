import {TexturedSpritesMaterial, type TexturedSpritesMaterialParameters} from '@spearwolf/twopoint5d';
import {Color, Vector4} from 'three';

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

    uniform float[2] screenResolution;
    uniform float[2] minMaxSizeScale;

    // varying float vTint;
    varying float vDepth;

  `,
  vertexPosition_instanced_vertex: `

    vec4 vertexPosition = vec4(instancePosition, 1.0);

  `,
  post_main_vertex: `

    vec2 scaleToPixel = vec2(4.0 / screenResolution[0] * gl_Position.w, 4.0 / screenResolution[1] * gl_Position.w);

    // vec2 minSize = vec2(quadSize.x * minMaxSizeScale[0], quadSize.y * minMaxSizeScale[0]);
    // vec2 maxSize = vec2(quadSize.y * minMaxSizeScale[1], quadSize.y * minMaxSizeScale[1]);
    //
    // vec2 size = mix(minSize, maxSize, 1.0 - clamp(0.0, 1.0, (gl_Position.z) / 2.0));
    // vec2 size = mix(minSize, maxSize, clamp(0.0, 1.0, (gl_Position.z + 1.0) / 2.0));
    // vec2 size = mix(minSize, maxSize, 1.0 + (gl_Position.z / 2.0));
    //
    vec2 size = quadSize.xy;

    gl_Position.x += position.x * scaleToPixel.x * size.x;
    gl_Position.y += position.y * scaleToPixel.y * size.y;
    
    // vTint = -(modelViewMatrix * vec4(instancePosition.xyz, 1.0)).z;
    float z = -(modelViewMatrix * vec4(instancePosition.xyz, 1.0)).z;
    vDepth = smoothstep(0.0, 1000.0, z);
  `,
  /*
  #include <after_vertexPosition_vertex>

  gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPosition.xyz, 1.0);

  vTexCoords = texCoords.xy + (uv * texCoords.zw);

  #include <post_main_vertex>
  */
  /*
  gl_Position = projectionMatrix * modelViewMatrix * vec4(poiPos, 1.0);

  vec2 scaleToPixel = vec2(4.0 / resolution[0] * gl_Position.w, 4.0 / resolution[1] * gl_Position.w);

  vec2 minSize = vec2(minMaxSize[0], minMaxSize[1]);
  vec2 maxSize = vec2(minMaxSize[2], minMaxSize[3]);

  vec2 size = mix(minSize, maxSize, 1.0 - clamp(0.0, 1.0, gl_Position.z / 2.0));

  gl_Position.x += (position.x + offset[0]) * scaleToPixel.x * size.x;
  gl_Position.y += (position.y + offset[1]) * scaleToPixel.y * size.y;
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

    // varying float vTint;
    varying float vDepth;
  `,
  post_main_fragment: `
    // gl_FragColor.xyz = mix(tintColorFar.xyz, tintColorNear.xyz, smoothstep(0.0, 1000.0, vTint));
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
        tintColorNear: {
          value: new Vector4(1, 1, 1, 1),
        },
        tintColorFar: {
          value: new Vector4(1, 1, 1, 1),
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
