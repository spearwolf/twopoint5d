// common used shader fragments

import {ShaderTool} from '@spearwolf/vertex-objects';

const ShaderLib: Record<string, string> = {
  rotateZ_vertex: ShaderTool.rotateZ(),

  makeBillboard_fn_vertex: `

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

  `,

  vertexPosition_makeBillboard_instanced_vertex: `

    vec4 vertexPosition = makeBillboard(
                            modelViewMatrix,
                            cameraPosition,
                            instancePosition,
                            quadSize,
                            (rotateZ(rotation) * vec4(position, 1.0)).xy
                          );
  `,

  vertexPosition_instanced_vertex: `

    vec4 vertexPosition = rotateZ(rotation)
                        * vec4(position * vec3(quadSize.xy, 0.0), 0.0)
                        + vec4(instancePosition, 1.0);

  `,

  discard_by_alpha_fragment: `

    if (gl_FragColor.a == 0.0) {
      discard;
    }

  `,
};

export default ShaderLib;
