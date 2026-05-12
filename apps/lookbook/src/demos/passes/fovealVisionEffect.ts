import {convertToTexture, distance, dot, Fn, mix, smoothstep, uv, vec2, vec3, vec4, viewportSize} from 'three/tsl';
import type {pass} from 'three/tsl';

/**
 * Foveal-vision post effect: sharp at the screen center, gradually blurred
 * and desaturated towards the periphery (rough approximation of how human
 * peripheral vision drops in detail and color).
 *
 * Call as a single positional `Fn` argument:
 * ```ts
 * stageRenderer.buildOutputNode = ([scenePass]) => fovealVisionEffect(scenePass);
 * ```
 */
export const fovealVisionEffect = Fn(([scenePass]: [ReturnType<typeof pass>]) => {
  // Sample-able view of the input pass; works for `PassNode`, `TextureNode`
  // or any other node `convertToTexture` knows about.
  const texNode = convertToTexture(scenePass);

  // 1. Zentrum und Koordinaten
  const center = vec2(0.5, 0.5);

  // Korrektur des Seitenverhältnisses
  const aspect = viewportSize.x.div(viewportSize.y);
  const aspectCorrectedUv = uv().sub(center).mul(vec2(aspect, 1.0)).add(center);
  const dist = distance(aspectCorrectedUv, center);

  // 2. Parameter für die Sehbereiche
  const foveaRadius = 0.45;
  const maxDist = 1.0;
  const effectFactor = smoothstep(foveaRadius, maxDist, dist);

  // 3. Peripherer Blur (5-Punkt-Sampling)
  const blurStrength = effectFactor.mul(0.01);

  const colorCenter = texNode.sample(uv());
  const colorRight = texNode.sample(uv().add(vec2(blurStrength, 0.0)));
  const colorLeft = texNode.sample(uv().sub(vec2(blurStrength, 0.0)));
  const colorUp = texNode.sample(uv().add(vec2(0.0, blurStrength)));
  const colorDown = texNode.sample(uv().sub(vec2(0.0, blurStrength)));

  const blurredColor = colorCenter.add(colorRight).add(colorLeft).add(colorUp).add(colorDown).div(5.0);

  // 4. Entsättigung (Luminanz)
  const luminanceWeights = vec3(0.2126, 0.7152, 0.0722);
  const grayscale = dot(blurredColor.rgb, luminanceWeights);

  // 5. Kombination
  const finalRGB = mix(blurredColor.rgb, vec3(grayscale), effectFactor);

  return vec4(finalRGB, 1.0);
});
