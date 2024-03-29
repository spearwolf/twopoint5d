precision highp float;

// https://threejs.org/docs/index.html#api/en/renderers/webgl/WebGLProgram

// uniform mat4 viewMatrix;
// uniform vec3 cameraPosition;

// -----------------------------------------------------------------------

uniform sampler2D colorMap;

varying vec2 vTexCoords;

void main() {
    gl_FragColor = texture2D(colorMap, vTexCoords);
    gl_FragColor.a *= 0.75;
}
