import {ShaderTool, unpick} from '@spearwolf/vertex-objects';
import {DoubleSide, ShaderMaterial, ShaderMaterialParameters, Texture} from 'three';

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

  ${ShaderTool.rotateZ()}

  vec2 texCoordsFromIndex(in vec2 mapSize, in int ndx) {
    int column = int(mod(float(ndx), float(mapSize[0])));
    int row = ndx / int(mapSize[0]);
    return (vec2(column, row) + 0.5) / vec2(mapSize[0], mapSize[1]);
  }

#ifdef RENDER_AS_BILLBOARDS

  vec4 makeBillboard(in mat4 modelViewMatrix, in vec3 cameraPosition, in vec3 billboardPosition, in vec2 billboardSize, in vec2 vertexPosition) {
    vec3 look = normalize(cameraPosition - billboardPosition);
    vec3 cameraUp = vec3(modelViewMatrix[0].y, modelViewMatrix[1].y, modelViewMatrix[2].y);
    vec3 billboardRight = cross(cameraUp, look);
    vec3 billboardUp = cross(look, billboardRight);

    return vec4(billboardPosition
                + billboardRight * vertexPosition.x * billboardSize.x
                + billboardUp * vertexPosition.y * billboardSize.y,
                1.0);
  }

#endif

  void main() {

#ifdef RENDER_AS_BILLBOARDS

    vec4 vertexPosition = makeBillboard(
                            modelViewMatrix,
                            cameraPosition,
                            instancePosition,
                            quadSize,
                            (rotateZ(rotation) * vec4(position, 1.0)).xy
                          );

#else

    vec4 vertexPosition = rotateZ(rotation)
                        * vec4(position * vec3(quadSize.xy, 0.0), 0.0)
                        + vec4(instancePosition, 1.0);

#endif

    gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPosition.xyz, 1.0);

    // ---- texture coords from frame based animations meta data ---------------
    vec4 animMetaData = texture2D(animsMap, texCoordsFromIndex(animsMapSize, int(animId)));
    int frameIndex = int(floor(mod((time + animOffset) / animMetaData.y * animMetaData.x, animMetaData.x)));
    vec4 texCoords = texture2D(animsMap, texCoordsFromIndex(animsMapSize, int(animMetaData.z) + frameIndex));

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

interface AnimatedSpritesMaterialParameters extends ShaderMaterialParameters {
  colorMap?: Texture;
  animsMap?: Texture;
  time?: number;
}

export class AnimatedSpritesMaterial extends ShaderMaterial {
  constructor(options?: AnimatedSpritesMaterialParameters) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
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
      ...unpick(options, 'colorMap', 'animsMap', 'time'),
    });

    this.name = options?.name ?? '@spearwolf/textured-sprites:AnimatedSpritesMaterial';
  }

  get colorMap(): Texture | undefined {
    return this.uniforms.colorMap.value;
  }

  set colorMap(colorMap: Texture | undefined) {
    this.uniforms.colorMap.value = colorMap;
  }

  get animsMap(): Texture | undefined {
    return this.uniforms.animsMap.value;
  }

  set animsMap(animsMap: Texture | undefined) {
    this.uniforms.animsMap.value = animsMap;
    this.uniforms.animsMapSize.value = animsMap ? [animsMap.image.width, animsMap.image.height] : [0, 0];
  }

  get renderAsBillboards(): boolean {
    return this.defines?.RENDER_AS_BILLBOARDS === 1;
  }

  set renderAsBillboards(renderAsBillboards: boolean) {
    if (renderAsBillboards) {
      Object.assign(this.defines, this.defines, {RENDER_AS_BILLBOARDS: 1});
    }
  }
}
