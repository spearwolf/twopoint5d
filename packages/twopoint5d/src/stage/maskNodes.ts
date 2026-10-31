import {clamp, float, luminance, uv} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {readMaskOptions, type StageMaskCoverageSource, type StageMaskOptions} from './StageMask.js';
import {
  hasTextureNode,
  isTextureNode,
  type StageTransitionSource,
  type StageTransitionSourceNode,
  textureSource,
} from './transitionEffects.js';

/**
 * The coverage of a premultiplied picture, from 0 to 1: the channel `source` names, or the
 * luminance of its premultiplied rgb, taken from `1` when `invert`.
 * @internal
 */
export function maskCoverage(picture: Node<'vec4'>, source: StageMaskCoverageSource, invert: boolean): Node<'float'> {
  const raw: Node<'float'> =
    source === 'alpha'
      ? picture.a
      : source === 'luminance'
        ? luminance(picture.rgb)
        : source === 'red'
          ? picture.r
          : source === 'green'
            ? picture.g
            : picture.b;
  const coverage = clamp(raw, 0, 1);
  return invert ? float(1).sub(coverage) : coverage;
}

export interface MaskNodeOptions extends StageMaskOptions {}

function sourceOf(node: StageTransitionSourceNode, role: string): StageTransitionSource {
  if (isTextureNode(node)) return textureSource(node);
  if (node != null && hasTextureNode(node)) return textureSource(node.getTextureNode());
  throw new TypeError(
    `createMaskNode: ${role} must be a TextureNode or a PassNode, got ${node == null ? describeValue(node) : describeThreeValue(node, 'isNode')}`,
  );
}

/**
 * Builds the node of `content` masked by `mask`, premultiplied, for a `buildOutputNode` of one's
 * own: all four channels of `content` times the coverage of `mask`. A source is a `TextureNode`
 * or the `PassNode` of a `Stage2D`, as for `createTransitionNode()`; both show nothing outside
 * `[0, 1]`, so a mask that does not reach a pixel covers 0 of it.
 */
export function createMaskNode(
  content: StageTransitionSourceNode,
  mask: StageTransitionSourceNode,
  options?: MaskNodeOptions,
): Node<'vec4'> {
  const {source, invert} = readMaskOptions('createMaskNode', options);
  const contentSource = sourceOf(content, 'content');
  const maskSource = sourceOf(mask, 'mask');
  const at = uv();
  return contentSource.sample(at).mul(maskCoverage(maskSource.sample(at), source, invert)) as Node<'vec4'>;
}
