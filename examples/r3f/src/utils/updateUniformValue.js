export function updateUniformValue(material, key, value) {
  if (material.uniforms[key]) {
    material.uniforms[key].value = value;
  } else {
    material.uniforms[key] = {
      value,
    };
  }
  // material.uniformsNeedUpdate = true;
}
