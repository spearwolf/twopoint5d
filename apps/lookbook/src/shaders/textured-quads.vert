attribute vec2 quadSize;
attribute vec3 instancePosition;
attribute vec4 texCoords;

varying vec2 vTexCoords;

void main() {
    vec4 pos = vec4(position.x * quadSize.x + instancePosition.x, position.y * quadSize.y + instancePosition.y, position.z + instancePosition.z, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * pos;

    vTexCoords = vec2(texCoords.x + (uv.x * texCoords.z), texCoords.y + (uv.y * texCoords.w));
}
