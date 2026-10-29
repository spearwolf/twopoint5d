import type {StageRendererBuildOutputNode} from '@spearwolf/twopoint5d';
import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';
import {vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';

export interface GlowLayerBuilder extends StageRendererBuildOutputNode {
  dispose(): void;
}

type Vec4 = Node<'vec4'> & {add(other: Node): Node<'vec4'>; rgb: Node<'vec3'>; a: Node<'float'>};

/**
 * A bloom for a layer of a `StageDirector`. `bloom()` of three.js answers an alpha of 1, and a layer
 * whose every pixel is opaque hides the layers below it: this builder adds the glow to the color as
 * light and keeps the alpha of the layer — premultiplied, a color over an alpha of 0 adds itself to
 * what lies below. It releases the bloom of the call before, and its last one in `dispose()`.
 */
export function createGlowLayerBuilder(strength: number, radius: number, threshold: number): GlowLayerBuilder {
  let last: ReturnType<typeof bloom> | undefined;
  const builder = ((passes: Node[]): Node => {
    let composed = passes[0] as Vec4;
    for (let i = 1; i < passes.length; i++) composed = composed.add(passes[i]!) as Vec4;
    const glow = bloom(composed, strength, radius, threshold);
    const output = vec4(composed.rgb.add((glow as unknown as Vec4).rgb), composed.a);
    last?.dispose();
    last = glow;
    return output as unknown as Node;
  }) as GlowLayerBuilder;
  builder.dispose = () => {
    last?.dispose();
    last = undefined;
  };
  return builder;
}
