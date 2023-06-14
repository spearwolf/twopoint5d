uniform sampler2D colorMap;

varying vec2 vTexCoords;

void main() {
    gl_FragColor = texture2D(colorMap, vTexCoords);

    gl_FragColor.a *= 0.75;
}
