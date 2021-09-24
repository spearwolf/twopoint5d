/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {DoubleSide, ShaderMaterial} from 'three';
// eslint-disable-next-line import/no-unresolved
import {ShaderTool} from '@spearwolf/three-vertex-objects';

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

export class AnimatedSpritesMaterial extends ShaderMaterial {
  constructor({colorMap, animsMap, ...options}) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        colorMap: {
          value: colorMap,
        },
        animsMap: {
          value: animsMap,
        },
        animsMapSize: {
          value: [animsMap.image.width, animsMap.image.height],
        },
        time: {
          value: 0,
        },
      },
      transparent: true,
      side: DoubleSide,
      ...options,
    });
    this.name = 'AnimatedSpritesMaterial';
  }

  get renderAsBillboards() {
    return this.defines?.RENDER_AS_BILLBOARDS === 1;
  }

  set renderAsBillboards(renderAsBillboards) {
    if (renderAsBillboards) {
      Object.assign(this.defines, this.defines, {RENDER_AS_BILLBOARDS: 1});
    }
  }
}
