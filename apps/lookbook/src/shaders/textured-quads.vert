precision highp float;

// https://threejs.org/docs/index.html#api/en/renderers/webgl/WebGLProgram

// = object.matrixWorld
// uniform mat4 modelMatrix;

// = camera.matrixWorldInverse * object.matrixWorld
uniform mat4 modelViewMatrix;

// = camera.projectionMatrix
uniform mat4 projectionMatrix;

// = camera.matrixWorldInverse
// uniform mat4 viewMatrix;

// = inverse transpose of modelViewMatrix
// uniform mat3 normalMatrix;

// = camera position in world space
// uniform vec3 cameraPosition;

// default vertex attributes provided by BufferGeometry
attribute vec3 position;
// attribute vec3 normal;
attribute vec2 uv;

// -----------------------------------------------------------------------

attribute vec2 quadSize;
attribute vec3 instancePosition;
attribute vec4 texCoords;

varying vec2 vTexCoords;

void main() {
    vec4 pos = vec4(position.x * quadSize.x + instancePosition.x, position.y * quadSize.y + instancePosition.y, position.z + instancePosition.z, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * pos;

    vTexCoords = vec2(texCoords.x + (uv.x * texCoords.z), texCoords.y + (uv.y * texCoords.w));
}
