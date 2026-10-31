import {texture} from 'three/tsl';
import {DataTexture, type Node, type TextureNode} from 'three/webgpu';
import {describe, expect, it} from 'vitest';
import {createMaskNode, maskCoverage} from './maskNodes.js';

const tex = () => new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
const textureNode = () => texture(tex()) as unknown as TextureNode;
const isNode = (node: unknown) => (node as {isNode?: boolean}).isNode === true;

describe('createMaskNode()', () => {
  it('takes a TextureNode, a PassNode and refuses null', () => {
    const pass = {getTextureNode: () => texture(tex())} as unknown as Node;
    expect(isNode(createMaskNode(textureNode(), textureNode()))).toBe(true);
    expect(isNode(createMaskNode(pass, pass, {source: 'luminance', invert: true}))).toBe(true);
    expect(() => createMaskNode(textureNode(), null)).toThrow(
      'createMaskNode: mask must be a TextureNode or a PassNode, got null',
    );
    expect(() => createMaskNode(undefined, textureNode())).toThrow(
      'createMaskNode: content must be a TextureNode or a PassNode, got undefined',
    );
    expect(() => createMaskNode({} as Node, textureNode())).toThrow(
      'createMaskNode: content must be a TextureNode or a PassNode',
    );
  });

  it('refuses options it cannot take, naming createMaskNode', () => {
    expect(() => createMaskNode(textureNode(), textureNode(), {source: 'lum' as any})).toThrow(
      `createMaskNode: source must be 'alpha', 'luminance', 'red', 'green' or 'blue', got "lum"`,
    );
    expect(() => createMaskNode(textureNode(), textureNode(), 'alpha' as any)).toThrow(
      'createMaskNode: the options must be an object',
    );
  });

  it('builds new nodes at every call', () => {
    const a = textureNode();
    const b = textureNode();
    expect(createMaskNode(a, b)).not.toBe(createMaskNode(a, b));
  });
});

describe('maskCoverage()', () => {
  const picture = () => texture(tex()) as unknown as Node<'vec4'>;

  it.each(['alpha', 'luminance', 'red', 'green', 'blue'] as const)('picks the channel for %s, inverted or not', (source) => {
    for (const invert of [false, true]) {
      const node = maskCoverage(picture(), source, invert);
      expect(isNode(node)).toBe(true);
      expect((node as {nodeType?: string}).nodeType ?? 'float').toMatch(/float|clamp|math/i);
    }
  });

  it('reads different channels into different graphs', () => {
    const p = picture();
    const nodes = (['alpha', 'red', 'green', 'blue', 'luminance'] as const).map((s) => maskCoverage(p, s, false));
    expect(new Set(nodes).size).toBe(5);
    expect(maskCoverage(p, 'red', true)).not.toBe(maskCoverage(p, 'red', false));
  });
});
