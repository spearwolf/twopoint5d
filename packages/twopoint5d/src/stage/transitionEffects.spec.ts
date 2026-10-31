import {texture, uniform, uv, vec2} from 'three/tsl';
import {Color, DataTexture, type Node, type TextureNode} from 'three/webgpu';
import {describe, expect, it} from 'vitest';
import {
  createTransitionNode,
  crossfade,
  dipToColor,
  dissolve,
  fade,
  iris,
  lumaMask,
  pixelate,
  slide,
  type StageTransitionEffect,
  type StageTransitionInput,
  textureSource,
  wipe,
} from './transitionEffects.js';
import {StageMask} from './StageMask.js';

const tex = () => new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);

function input(): StageTransitionInput {
  return {
    from: textureSource(texture(tex()) as unknown as TextureNode),
    to: textureSource(texture(tex()) as unknown as TextureNode),
    progress: uniform(0) as unknown as Node<'float'>,
    uv: uv(),
    resolution: vec2(64, 64) as unknown as Node<'vec2'>,
    mask: () => {
      throw new Error('no masks in these tests');
    },
  };
}

describe('transition effects', () => {
  const effects: [string, () => StageTransitionEffect][] = [
    ['crossfade', () => crossfade()],
    ['fade', () => fade()],
    ['dipToColor', () => dipToColor({color: new Color('#fff')})],
    ['wipe', () => wipe({direction: 'up', softness: 0})],
    ['wipe', () => wipe({direction: Math.PI / 4})],
    ['slide', () => slide({direction: 'right', mode: 'cover'})],
    ['slide', () => slide({mode: 'reveal'})],
    ['iris', () => iris({center: [0.25, 0.75]})],
    ['dissolve', () => dissolve({scale: 4})],
    ['lumaMask', () => lumaMask({mask: tex(), invert: true})],
    ['pixelate', () => pixelate({maxBlockSize: 16})],
  ];

  it.each(effects)('%s builds a node and keeps its name', (name, make) => {
    const effect = make();
    expect(effect.name).toBe(name);
    const node = effect.build(input());
    expect((node as {isNode?: boolean}).isNode).toBe(true);
    // a description: every call builds new nodes
    expect(effect.build(input())).not.toBe(node);
  });

  it('refuses options it cannot take, naming the effect', () => {
    expect(() => wipe({direction: 'north' as any})).toThrow(
      "wipe: direction must be 'left', 'right', 'up', 'down' or an angle in radians",
    );
    expect(() => wipe({softness: -1})).toThrow('wipe: softness must be a finite number of 0 or above, got -1');
    expect(() => slide({direction: 1 as any})).toThrow("slide: direction must be 'left', 'right', 'up' or 'down'");
    expect(() => slide({mode: 'zoom' as any})).toThrow("slide: mode must be 'push', 'cover' or 'reveal'");
    expect(() => iris({center: [0.5] as any})).toThrow('iris: center must be a pair [x, y] in uv');
    expect(() => dissolve({scale: 0})).toThrow('dissolve: scale must be a finite number above 0, got 0');
    expect(() => lumaMask({mask: {} as any})).toThrow('lumaMask: mask must be a Texture');
    expect(() => pixelate({maxBlockSize: Number.NaN})).toThrow(RangeError);
    expect(() => dipToColor({color: '#fff' as any})).toThrow('dipToColor: color must be a Color');
    expect(() => crossfade.call(null)).not.toThrow();
    expect(() => wipe('left' as any)).toThrow('wipe: the options must be an object');
  });

  describe('createTransitionNode()', () => {
    it('takes a texture node, a pass node and nothing, and makes a progress uniform when none is handed in', () => {
      const a = texture(tex()) as unknown as TextureNode;
      const pass = {getTextureNode: () => texture(tex())} as unknown as Node;
      const {node, progress} = createTransitionNode(crossfade(), a, pass);
      expect((node as {isNode?: boolean}).isNode).toBe(true);
      expect((progress as unknown as {value: number}).value).toBe(0);

      const own = uniform(0.5) as unknown as Node<'float'>;
      expect(createTransitionNode(fade(), null, a, own).progress).toBe(own);
    });

    it('refuses a source and an effect it cannot take', () => {
      expect(() => createTransitionNode(crossfade(), {} as Node, null)).toThrow(
        'createTransitionNode: from must be a TextureNode, a PassNode or null',
      );
      expect(() => createTransitionNode({} as any, null, null)).toThrow(
        'createTransitionNode: effect must be a StageTransitionEffect',
      );
    });

    it('refuses an effect with masks up front, and answers an input whose mask() throws', () => {
      const a = texture(tex()) as unknown as TextureNode;
      const mask = new StageMask({name: 'ink', resize() {}, updateFrame() {}, renderTo() {}});
      let built = 0;
      const withMasks: StageTransitionEffect = {
        name: 'inkIn',
        masks: [mask],
        build: ({from}) => {
          built++;
          return from.sample(uv());
        },
      };
      expect(() => createTransitionNode(withMasks, a, null)).toThrow(
        'createTransitionNode: an effect with masks needs a StageDirector',
      );
      expect(built).toBe(0);

      // an empty list of masks is no mask
      expect(() => createTransitionNode({...crossfade(), masks: []}, a, null)).not.toThrow();

      const sneaky: StageTransitionEffect = {name: 'sneaky', build: (input) => input.mask(mask).sample(uv())};
      expect(() => createTransitionNode(sneaky, a, null)).toThrow(
        'createTransitionNode: an effect with masks needs a StageDirector',
      );
    });
  });
});
