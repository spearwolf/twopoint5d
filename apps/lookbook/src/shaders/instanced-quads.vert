attribute vec2 quadSize;
attribute vec3 instancePosition;

void main() {
    vec4 pos = vec4(position.x * quadSize.x + instancePosition.x, position.y * quadSize.y + instancePosition.y, position.z + instancePosition.z, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * pos;
}
