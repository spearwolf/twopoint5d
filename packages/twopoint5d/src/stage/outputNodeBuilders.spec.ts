import {texture} from 'three/tsl';
import BloomNode from 'three/examples/jsm/tsl/display/BloomNode.js';
import {createSandbox} from 'sinon';
import {type Node, Texture} from 'three/webgpu';
import {afterEach, describe, expect, it} from 'vitest';
import {createBloomOutputNodeBuilder} from './outputNodeBuilders.js';

// every node reachable from `root`, `root` included; a node is visited once
function reachableFrom(root: Node, skip?: (node: Node) => boolean): Set<Node> {
  const seen = new Set<Node>();
  const visit = (node: Node) => {
    if (seen.has(node) || skip?.(node)) return;
    seen.add(node);
    for (const child of node.getChildren()) visit(child);
  };
  visit(root);
  return seen;
}

const findBlooms = (root: Node): BloomNode[] => [...reachableFrom(root)].filter((n): n is BloomNode => n instanceof BloomNode);

const makePass = (): Node => texture(new Texture()) as unknown as Node;

describe('createBloomOutputNodeBuilder()', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('composes the passes additively and adds the bloom of the composition on top', () => {
    const [a, b] = [makePass(), makePass()];
    const output = createBloomOutputNodeBuilder()([a, b]);

    const blooms = findBlooms(output);
    expect(blooms).toHaveLength(1);

    const fromBloomInput = reachableFrom(blooms[0]!.inputNode as Node);
    expect(fromBloomInput.has(a)).toBe(true);
    expect(fromBloomInput.has(b)).toBe(true);

    // the scene stands in the output, not only the glow
    const besidesBloom = reachableFrom(output, (n) => n instanceof BloomNode);
    expect(besidesBloom.has(a)).toBe(true);
    expect(besidesBloom.has(b)).toBe(true);
  });

  it('hands a single pass to the bloom as it is', () => {
    const pass = makePass();
    const output = createBloomOutputNodeBuilder()([pass]);

    expect(findBlooms(output)[0]!.inputNode).toBe(pass);
  });

  it('hands strength, radius and threshold to the bloom, with the defaults of three.js', () => {
    const custom = findBlooms(createBloomOutputNodeBuilder({strength: 1.2, radius: 0.6, threshold: 0.1})([makePass()]))[0]!;
    expect(custom.strength.value).toBe(1.2);
    expect(custom.radius.value).toBe(0.6);
    expect(custom.threshold.value).toBe(0.1);

    const defaults = findBlooms(createBloomOutputNodeBuilder()([makePass()]))[0]!;
    expect(defaults.strength.value).toBe(1);
    expect(defaults.radius.value).toBe(0);
    expect(defaults.threshold.value).toBe(0);
  });

  it('reads its options once, when it is created', () => {
    const options = {strength: 1.2, radius: 0.6, threshold: 0.1};
    const builder = createBloomOutputNodeBuilder(options);
    options.strength = 5;
    options.radius = 1;
    options.threshold = 0.9;

    const bloomNode = findBlooms(builder([makePass()]))[0]!;
    expect(bloomNode.strength.value).toBe(1.2);
    expect(bloomNode.radius.value).toBe(0.6);
    expect(bloomNode.threshold.value).toBe(0.1);
  });

  it('releases the bloom of the previous call once the next output node stands', () => {
    const builder = createBloomOutputNodeBuilder();
    const pass = makePass();

    const first = findBlooms(builder([pass]))[0]!;
    const firstDispose = sandbox.spy(first, 'dispose');
    const second = findBlooms(builder([pass]))[0]!;
    const secondDispose = sandbox.spy(second, 'dispose');

    expect(second).not.toBe(first);
    expect(firstDispose.calledOnce).toBe(true);
    expect(secondDispose.called).toBe(false);
  });

  it('throws for an empty pass list and keeps the bloom it built last', () => {
    const builder = createBloomOutputNodeBuilder();
    const built = findBlooms(builder([makePass()]))[0]!;
    const builtDispose = sandbox.spy(built, 'dispose');

    expect(() => builder([])).toThrow('The builder of createBloomOutputNodeBuilder() has no passes to compose');
    expect(builtDispose.called).toBe(false);
  });

  it('leaves the passes alone', () => {
    const [a, b] = [makePass(), makePass()];
    const aDispose = sandbox.spy(a, 'dispose');
    const bDispose = sandbox.spy(b, 'dispose');
    const builder = createBloomOutputNodeBuilder();

    builder([a, b]);
    builder([a, b]);
    builder.dispose();

    expect(aDispose.called).toBe(false);
    expect(bDispose.called).toBe(false);
  });

  it('isDisposed is false until dispose()', () => {
    const builder = createBloomOutputNodeBuilder();
    expect(builder.isDisposed).toBe(false);
    builder.dispose();
    expect(builder.isDisposed).toBe(true);
  });

  describe('dispose()', () => {
    // (a) the bloom it built itself is released exactly once
    it('releases the bloom it built last, once', () => {
      const builder = createBloomOutputNodeBuilder();
      const built = findBlooms(builder([makePass()]))[0]!;
      const builtDispose = sandbox.spy(built, 'dispose');

      builder.dispose();

      expect(builtDispose.calledOnce).toBe(true);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    it('behaves as documented after dispose()', () => {
      const builder = createBloomOutputNodeBuilder();
      builder.dispose();

      expect(builder.isDisposed).toBe(true);
      expect(() => builder([makePass()])).toThrow(
        'The builder of createBloomOutputNodeBuilder() is not available: this builder has been disposed',
      );
    });

    // (d) the second call throws nothing and releases nothing a second time
    it('is safe to call twice', () => {
      const builder = createBloomOutputNodeBuilder();
      const built = findBlooms(builder([makePass()]))[0]!;
      const builtDispose = sandbox.spy(built, 'dispose');

      expect(() => {
        builder.dispose();
        builder.dispose();
      }).not.toThrow();

      expect(builtDispose.calledOnce).toBe(true);
    });

    it('releases nothing when it has built nothing', () => {
      const builder = createBloomOutputNodeBuilder();

      expect(() => builder.dispose()).not.toThrow();
      expect(builder.isDisposed).toBe(true);
    });
  });
});
