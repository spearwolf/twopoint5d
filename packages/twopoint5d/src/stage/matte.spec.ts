import {float, mix, select, texture, uniform, uv, vec2} from 'three/tsl';
import {DataTexture, type Node, type TextureNode} from 'three/webgpu';
import {describe, expect, it, vi} from 'vitest';
import {StageMask} from './StageMask.js';
import {
  matte,
  type StageMaskSource,
  type StageTransitionInput,
  type StageTransitionSource,
  switched,
  textureSource,
} from './transitionEffects.js';

const tex = () => new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
const stage = (name = 'ink') => ({name, resize() {}, updateFrame() {}, renderTo() {}});

/** An input whose mask() answers `coverage` and records the uv it is asked at. */
function inputWith(mask: StageMask, coverage: Node<'float'>) {
  const at: Node<'vec2'>[] = [];
  const fromNode = texture(tex()) as unknown as TextureNode;
  const toNode = texture(tex()) as unknown as TextureNode;
  const labels = new Map<Node, string>([
    [fromNode.getBase(), 'from'],
    [toNode.getBase(), 'to'],
  ]);
  const from = textureSource(fromNode);
  const to = textureSource(toNode);
  const fromSample = vi.spyOn(from, 'sample');
  const toSample = vi.spyOn(to, 'sample');
  const maskSource: StageMaskSource = {
    sample: from.sample,
    coverage: (uvNode) => {
      at.push(uvNode);
      return coverage;
    },
  };
  const input: StageTransitionInput = {
    from: from as StageTransitionSource,
    to: to as StageTransitionSource,
    progress: uniform(0) as unknown as Node<'float'>,
    uv: uv(),
    resolution: vec2(64, 64) as unknown as Node<'vec2'>,
    mask: (m) => {
      if (m !== mask) throw new Error('not named');
      return maskSource;
    },
  };
  return {input, at, fromSample, toSample, labels};
}

/**
 * The shape of a graph as text: operators and constants by value, the leaves it was built from
 * (uniforms, texture nodes, the uv) by the order of their first appearance. Two graphs built from
 * the same leaves in the same way have the same shape; `labels` names leaves that must stay apart. (The cache key of a node is no help here: it
 * holds the identity of every node, so two equal graphs differ.)
 */
function keyOf(root: Node, labels?: ReadonlyMap<Node, string>): string {
  const ids = new Map<Node, number>();
  const walk = (node: Node): string => {
    // the textures of from and to keep their names: a swapped pair stays a swap
    const base = (node as Partial<TextureNode>).getBase?.() ?? node;
    const named = labels?.get(base) ?? labels?.get(node);
    if (named !== undefined) return `${node.constructor.name}<${named}>`;
    const children = [...(node.getChildren() as Iterable<Node>)];
    const inner = node as unknown as {op?: string; scope?: string; method?: string; value?: unknown};
    if (children.length === 0) {
      if (typeof inner.value === 'number' && node.constructor.name === 'ConstNode') return `const(${inner.value})`;
      if (!ids.has(node)) ids.set(node, ids.size);
      return `${node.constructor.name}#${ids.get(node)}`;
    }
    const label = [node.constructor.name, inner.op, inner.scope, inner.method].filter(Boolean).join(':');
    return `${label}(${children.map(walk).join(',')})`;
  };
  return walk(root);
}

describe('matte()', () => {
  it('names itself and its mask', () => {
    const mask = new StageMask(stage());
    const effect = matte({mask});
    expect(effect.name).toBe('matte');
    expect(effect.masks).toEqual([mask]);
  });

  it('refuses a missing mask', () => {
    expect(() => matte({} as any)).toThrow('matte: mask must be a StageMask, got undefined');
    expect(() => matte({mask: tex() as any})).toThrow('matte: mask must be a StageMask, got ');
    expect(() => matte(undefined as any)).toThrow('matte: mask must be a StageMask, got undefined');
    expect(() => matte('ink' as any)).toThrow('matte: the options must be an object');
  });

  it('refuses an unknown mode', () => {
    const mask = new StageMask(stage());
    expect(() => matte({mask, mode: 'luma' as any})).toThrow("matte: mode must be 'coverage' or 'threshold', got \"luma\"");
  });

  it('refuses a negative softness', () => {
    const mask = new StageMask(stage());
    expect(() => matte({mask, softness: -0.1})).toThrow('matte: softness must be a finite number of 0 or above, got -0.1');
    expect(() => matte({mask, softness: Number.NaN})).toThrow(RangeError);
    expect(() => matte({mask, softness: 0})).not.toThrow();
  });

  it('refuses a disposed mask', () => {
    const mask = new StageMask(stage('gone'));
    mask.dispose();
    expect(() => matte({mask})).toThrow('matte: the mask on "gone" has been disposed');
  });

  it('reads its options once, when it is made', () => {
    const mask = new StageMask(stage());
    const options = {mask, mode: 'coverage' as const};
    const effect = matte(options);
    options.mode = 'threshold' as any;
    const coverage = float(0.5);
    const one = inputWith(mask, coverage);
    const two = inputWith(mask, coverage);
    const same = matte({mask, mode: 'coverage'}).build(two.input);
    // the same graph as an effect made with 'coverage' — the later change of the object is not seen
    expect(keyOf(effect.build(one.input), one.labels)).toBe(keyOf(same, two.labels));
  });

  it('builds a new node on every call', () => {
    const mask = new StageMask(stage());
    const effect = matte({mask});
    const {input} = inputWith(mask, float(0.5));
    expect(effect.build(input)).not.toBe(effect.build(input));
  });

  describe('coverage mode', () => {
    it('holds both ends whatever the mask draws', () => {
      const mask = new StageMask(stage());
      const coverage = float(0.3);
      const {input, labels} = inputWith(mask, coverage);
      const node = matte({mask}).build(input);
      // 0 at progress <= 0, 1 at progress >= 1, the coverage between — and nothing else
      const share = select(
        input.progress.lessThanEqual(0),
        float(0),
        select(input.progress.greaterThanEqual(1), float(1), coverage),
      );
      const expected = mix(input.from.sample(input.uv), input.to.sample(input.uv), share);
      expect(keyOf(node, labels)).toBe(keyOf(expected, labels));
      // the direction: `from` is the first sample, `to` the second — a swap is a different graph
      const swapped = mix(input.to.sample(input.uv), input.from.sample(input.uv), share);
      expect(keyOf(swapped, labels)).not.toBe(keyOf(expected, labels));
    });

    it('is the default mode', () => {
      const mask = new StageMask(stage());
      const coverage = float(0.3);
      const one = inputWith(mask, coverage);
      const two = inputWith(mask, coverage);
      const a = matte({mask}).build(one.input);
      const b = matte({mask, mode: 'coverage'}).build(two.input);
      expect(keyOf(a, one.labels)).toBe(keyOf(b, two.labels));
    });
  });

  describe('threshold mode', () => {
    it('switches by the coverage as lumaMask does', () => {
      const mask = new StageMask(stage());
      const coverage = float(0.3);
      for (const softness of [undefined, 0, 0.2]) {
        const {input, labels} = inputWith(mask, coverage);
        const node = matte({mask, mode: 'threshold', softness}).build(input);
        const share = switched(coverage, input.progress, softness ?? 0.05);
        const expected = mix(input.from.sample(input.uv), input.to.sample(input.uv), share);
        expect(keyOf(node, labels)).toBe(keyOf(expected, labels));
        const swapped = mix(input.to.sample(input.uv), input.from.sample(input.uv), share);
        expect(keyOf(swapped, labels)).not.toBe(keyOf(expected, labels));
      }
    });

    it('differs from coverage mode', () => {
      const mask = new StageMask(stage());
      const coverage = float(0.3);
      const one = inputWith(mask, coverage);
      const two = inputWith(mask, coverage);
      const a = matte({mask, mode: 'threshold'}).build(one.input);
      const b = matte({mask}).build(two.input);
      expect(keyOf(a, one.labels)).not.toBe(keyOf(b, two.labels));
    });
  });

  it.each(['coverage', 'threshold'] as const)('the mask is sampled at uv, not flipped (%s)', (mode) => {
    const mask = new StageMask(stage());
    const {input, at, fromSample, toSample} = inputWith(mask, float(0.5));
    matte({mask, mode}).build(input);
    expect(at).toEqual([input.uv]);
    expect(at[0]).toBe(input.uv);
    // both sources too, in place
    expect(fromSample).toHaveBeenCalledWith(input.uv);
    expect(toSample).toHaveBeenCalledWith(input.uv);
  });
});
