import {add, attribute, vec2, vec4} from 'three/tsl';
import {type Node, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {attributeNamesOf, evaluateNode, graphSignature, nodesOf, samplesTexture} from '../../testing/spriteGraph.js';
import {defineSprite} from '../defineSprite.js';
import {AtlasFrame} from '../features/AtlasFrame.js';
import {FlatPlacement} from '../features/FlatPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {TextureColor} from '../features/TextureColor.js';
import {definePass} from '../passes/definePass.js';
import {BillboardPlacement} from '../features/BillboardPlacement.js';
import {TexturedSpriteKind} from '../presets.js';
import {QuadBase} from '../SpriteBase.js';
import {defineFeature, type SpriteFeature, type SpriteFrameNodes} from '../SpriteFeature.js';
import {FeatureSpritesMaterial} from './FeatureSpritesMaterial.js';

const withImage = (width = 4, height = 4) => {
  const texture = new Texture();
  texture.image = {width, height} as unknown as HTMLImageElement;
  return texture;
};

const calls: string[] = [];
afterEach(() => {
  calls.length = 0;
});

const vec4Of = (...values: [number, number, number, number]) => vec4(...values) as unknown as Node<'vec4'>;

// a frame stage that records its call and adds `delta` to the tex coords it is handed
const shifting = (name: string, order: number, delta: number, extra: Partial<SpriteFeature> = {}): SpriteFeature =>
  defineFeature({
    name,
    ...extra,
    frameStage: {
      order,
      transform: (frame) => {
        calls.push(name);
        return {...frame, texCoords: add(frame.texCoords, delta) as unknown as Node<'vec4'>};
      },
    },
  });

// a uv stage that records its call and adds `delta` to the uv it is handed
const uvShifting = (name: string, order: number, delta: number, extra: Partial<SpriteFeature> = {}): SpriteFeature =>
  defineFeature({
    name,
    ...extra,
    uv: {
      order,
      transform: (uv) => {
        calls.push(name);
        return add(uv, delta) as unknown as Node<'vec2'>;
      },
    },
  });

const kindOf = (...features: SpriteFeature[]) =>
  defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, ...features]});

describe('frame stages', () => {
  test('run after the frame slot, by order and then by the feature list', () => {
    const frameSlot = defineFeature({
      name: 'slot',
      frame: () => {
        calls.push('slot');
        return {texCoords: vec4Of(1, 2, 3, 4)};
      },
    });
    const material = new FeatureSpritesMaterial(
      kindOf(frameSlot, shifting('late', 200, 100), shifting('early', 100, 10), shifting('tie', 100, 1)),
    );

    expect(calls).toEqual(['slot', 'early', 'tie', 'late']);
    material.dispose();
  });

  test('run on the defaults when the kind has no frame feature', () => {
    let seen: SpriteFrameNodes | undefined;
    const probe = defineFeature({
      name: 'probe',
      frameStage: {
        order: 0,
        transform: (frame) => {
          seen = frame;
          return frame;
        },
      },
    });
    const material = new FeatureSpritesMaterial(kindOf(probe));

    expect(evaluateNode(seen!.texCoords)).toEqual([0, 0, 1, 1]);
    material.dispose();
  });

  test('hand their result to the trim shift and to the color source', () => {
    const texCoords = vec4Of(0.25, 0, 0.5, 1);
    const trim = vec4Of(0.1, 0, 0, 0);
    const replacing = defineFeature({name: 'replacing', frameStage: {order: 0, transform: () => ({texCoords, trim})}});
    const material = new FeatureSpritesMaterial(kindOf(AtlasFrame, replacing, TextureColor), {
      textures: {colorMap: new Texture()},
    });

    expect(nodesOf(material.positionNode!).has(trim)).toBe(true);
    expect(nodesOf(material.colorNode!).has(texCoords)).toBe(true);
    expect(attributeNamesOf(material.colorNode!)).not.toContain('texCoords');
    material.dispose();
  });

  test('leave the frame a color source gets as the frame slot answered it, without a frame stage', () => {
    const answered: SpriteFrameNodes = {texCoords: vec4Of(0, 0, 1, 1)};
    let got: SpriteFrameNodes | undefined;
    const slot = defineFeature({name: 'slot', frame: () => answered});
    const source = defineFeature({
      name: 'source',
      colorSource: (frame) => {
        got = frame;
        return frame.texCoords;
      },
    });
    const material = new FeatureSpritesMaterial(kindOf(slot, source));

    expect(got).toBe(answered);
    material.dispose();
  });

  test('a frame stage whose texture is unset drops out until it is set', () => {
    const waiting = shifting('waiting', 0, 1, {textures: {flipMap: {}}});
    const material = new FeatureSpritesMaterial(kindOf(waiting));

    expect(calls).toEqual([]);
    material.setTexture('flipMap', new Texture());
    expect(calls).toEqual(['waiting']);
    material.dispose();
  });

  test('its lookups take a new texture of the same kind without a rebuild', () => {
    const sampling = defineFeature({
      name: 'sampling',
      textures: {flipMap: {}},
      frameStage: {order: 0, transform: (frame, {sample}) => ({...frame, trim: sample('flipMap', vec2(0, 0) as never)})},
    });
    const first = new Texture();
    const second = new Texture();
    const material = new FeatureSpritesMaterial(kindOf(sampling), {textures: {flipMap: first}});
    const positionNode = material.positionNode;

    material.setTexture('flipMap', second);

    expect(material.positionNode).toBe(positionNode);
    expect(samplesTexture(material.positionNode!, second)).toBe(true);
    material.dispose();
  });

  test('a pass brings a frame stage of its own', () => {
    const material = new FeatureSpritesMaterial(TexturedSpriteKind, {
      pass: definePass({name: 'p', features: [shifting('passStage', 0, 1)]}),
    });

    expect(calls).toEqual(['passStage']);
    material.dispose();
  });
});

describe('uv stages and ctx.uv', () => {
  test('run by order and then by the feature list, and the color source samples at their result', () => {
    const material = new FeatureSpritesMaterial(
      kindOf(AtlasFrame, uvShifting('late', 200, 100), uvShifting('early', 100, 10), uvShifting('tie', 100, 1), TextureColor),
      {textures: {colorMap: new Texture()}},
    );

    expect(calls).toEqual(['early', 'tie', 'late']);
    material.dispose();
  });

  test('ctx.uv is the base uv after the uv stages; in a uv stage it is the stage input', () => {
    let inStage: {input: Node; uv: Node} | undefined;
    let inSource: Node | undefined;
    const marker = vec2(7, 7) as unknown as Node<'vec2'>;
    const stage = defineFeature({
      name: 'stage',
      uv: {
        order: 0,
        transform: (input, ctx) => {
          inStage = {input, uv: ctx.uv};
          return marker;
        },
      },
    });
    const source = defineFeature({
      name: 'source',
      colorSource: (_frame, ctx) => {
        inSource = ctx.uv;
        return vec4Of(1, 1, 1, 1);
      },
    });
    const material = new FeatureSpritesMaterial(kindOf(stage, source));

    expect(inStage!.uv).toBe(inStage!.input);
    expect(attributeNamesOf(inStage!.input)).toEqual(['uv']);
    expect(inSource).toBe(marker);
    material.dispose();
  });

  test('is the base uv attribute without uv stages', () => {
    let uv: Node | undefined;
    const source = defineFeature({
      name: 'source',
      colorSource: (_frame, ctx) => {
        uv = ctx.uv;
        return vec4Of(1, 1, 1, 1);
      },
    });
    const material = new FeatureSpritesMaterial(kindOf(source));

    expect(graphSignature(uv!)).toBe(graphSignature(attribute('uv') as unknown as Node));
    material.dispose();
  });

  test('builds the uv stages once per graph that reads ctx.uv, and not for a graph that does not', () => {
    const twice = defineFeature({
      name: 'twice',
      colorSource: (_frame, ctx) => add(vec4(ctx.uv, 0, 0), vec4(ctx.uv, 0, 0)) as unknown as Node<'vec4'>,
    });
    const material = new FeatureSpritesMaterial(kindOf(uvShifting('stage', 0, 1), twice));

    expect(calls).toEqual(['stage']);
    material.dispose();
  });

  test('a stage of the position graph that reads ctx.uv builds the uv stages there as well', () => {
    const reader = defineFeature({
      name: 'reader',
      local: {order: 0, transform: (position, ctx) => add(position, vec4(ctx.uv, 0, 0).xyz) as unknown as Node<'vec3'>},
    });
    const material = new FeatureSpritesMaterial(kindOf(uvShifting('stage', 0, 1), reader));

    expect(calls).toEqual(['stage']);
    material.dispose();
  });

  test('a uv stage whose texture is unset drops out until it is set', () => {
    const material = new FeatureSpritesMaterial(kindOf(uvShifting('waiting', 0, 1, {textures: {warpMap: {}}}), TextureColor), {
      textures: {colorMap: new Texture()},
    });

    expect(calls).toEqual([]);
    material.setTexture('warpMap', new Texture());
    expect(calls).toEqual(['waiting']);
    material.dispose();
  });

  test('the lookups of a uv stage take a new texture of the same kind without a rebuild', () => {
    const warping = defineFeature({
      name: 'warping',
      textures: {warpMap: {}},
      uv: {order: 0, transform: (uv, {sample}) => add(uv, sample('warpMap', uv).xy) as unknown as Node<'vec2'>},
    });
    const first = new Texture();
    const second = new Texture();
    const material = new FeatureSpritesMaterial(kindOf(AtlasFrame, warping, TextureColor), {
      textures: {colorMap: new Texture(), warpMap: first},
    });
    const colorNode = material.colorNode;
    expect(samplesTexture(colorNode!, first)).toBe(true);

    material.setTexture('warpMap', second);

    expect(material.colorNode).toBe(colorNode);
    expect(samplesTexture(colorNode!, second)).toBe(true);
    expect(samplesTexture(colorNode!, first)).toBe(false);
    material.dispose();
  });

  test('a pass brings a uv stage of its own', () => {
    const material = new FeatureSpritesMaterial(TexturedSpriteKind, {
      textures: {colorMap: new Texture()},
      pass: definePass({name: 'p', features: [uvShifting('passUv', 0, 1)]}),
    });

    expect(calls).toEqual(['passUv']);
    material.dispose();
  });
});

describe('textureSize() of a texture another feature declares', () => {
  const sizeReader = (textureName: string) =>
    defineFeature({
      name: 'sizeReader',
      local: {
        order: 0,
        transform: (position, {textureSize}) => {
          calls.push('sizeReader');
          return add(position, vec4(textureSize(textureName), 0, 0).xyz) as unknown as Node<'vec3'>;
        },
      },
    });

  // the TextureSizeNodes of a graph, and the textures they measure
  const sizeNodesOf = (root: Node) =>
    [...nodesOf(root)].filter((node) => (node as {isTextureSizeNode?: boolean}).isTextureSizeNode === true) as unknown as {
      textureNode: {value: Texture};
    }[];

  test('answers (0, 0) while that texture is unset, and does not wait for it', () => {
    const material = new FeatureSpritesMaterial(kindOf(AtlasFrame, TextureColor, sizeReader('colorMap')));
    const size = material.resources.textureSize('colorMap');

    expect(calls).toEqual(['sizeReader']);
    expect(nodesOf(material.positionNode!).has(size as unknown as Node)).toBe(true);
    expect(size.value.toArray()).toEqual([0, 0]);
    material.dispose();
  });

  test('once the texture is set, answers the size of the texture the shader binds, which follows a swap without rebuild', () => {
    const first = new Texture();
    const second = new Texture();
    const material = new FeatureSpritesMaterial(kindOf(AtlasFrame, TextureColor, sizeReader('colorMap')));

    material.setTexture('colorMap', first);
    const positionNode = material.positionNode!;
    expect(sizeNodesOf(positionNode).map(({textureNode}) => textureNode.value)).toEqual([first]);

    material.setTexture('colorMap', second);
    expect(material.positionNode).toBe(positionNode);
    expect(sizeNodesOf(positionNode).map(({textureNode}) => textureNode.value)).toEqual([second]);
    material.dispose();
  });

  test('reads the size of a texture of its own the same way, and a texture that needs its image through the uniform', () => {
    const own = defineFeature({
      name: 'own',
      textures: {ownMap: {}, waitedMap: {needsImage: true}},
      local: {
        order: 0,
        transform: (position, {textureSize}) =>
          add(position, vec4(textureSize('ownMap'), textureSize('waitedMap')).xyz) as unknown as Node<'vec3'>,
      },
    });
    const ownMap = new Texture();
    const material = new FeatureSpritesMaterial(kindOf(own), {textures: {ownMap, waitedMap: withImage(4, 2)}});

    expect(sizeNodesOf(material.positionNode!).map(({textureNode}) => textureNode.value)).toEqual([ownMap]);
    expect(nodesOf(material.positionNode!).has(material.resources.textureSize('waitedMap') as unknown as Node)).toBe(true);
    material.dispose();
  });

  test('is refused for a texture no feature of the material declares, naming it', () => {
    expect(() => new FeatureSpritesMaterial(kindOf(AtlasFrame, TextureColor, sizeReader('normalMap')))).toThrow(
      'FeatureSpritesMaterial: feature "sizeReader" reads the size of the texture "normalMap", which no feature of these sprites declares',
    );
  });
});

describe('checkKind', () => {
  test('a placement that carries checkKind stands in on a live material, and its check runs', () => {
    const seen: string[][] = [];
    const checked = defineFeature({
      name: 'checkedPlacement',
      requires: ['instancePosition'],
      checkKind: ({features}) => {
        seen.push(features.map(({name}) => name));
      },
      placement: BillboardPlacement.placement,
    });
    const material = new FeatureSpritesMaterial(kindOf(AtlasFrame, TextureColor));

    material.placement = checked;

    expect(material.placement).toBe(checked);
    expect(seen).toEqual([['instancePosition', 'checkedPlacement', 'atlasFrame', 'textureColor']]);
    material.dispose();
  });

  test('a placement whose check refuses the kind does not stand in', () => {
    const refusing = defineFeature({
      name: 'refusing',
      requires: ['instancePosition'],
      checkKind: () => {
        throw new Error('not on this kind — take another');
      },
      placement: BillboardPlacement.placement,
    });
    const material = new FeatureSpritesMaterial(kindOf(AtlasFrame, TextureColor));

    expect(() => {
      material.placement = refusing;
    }).toThrow('FeatureSpritesMaterial: feature "refusing": not on this kind — take another');
    expect(material.placement).toBe(FlatPlacement);
    material.dispose();
  });

  test('a feature of a pass is checked against the features the pass draws with', () => {
    const seen: string[][] = [];
    const watcher = defineFeature({
      name: 'watcher',
      checkKind: ({base, features}) => {
        expect(base).toBe(QuadBase);
        seen.push(features.map(({name}) => name));
      },
      color: {order: 1, transform: (color) => color},
    });
    const refusing = defineFeature({
      name: 'refusing',
      checkKind: () => {
        throw new Error('needs a grid');
      },
    });
    const kind = kindOf(AtlasFrame, TextureColor);
    const material = new FeatureSpritesMaterial(kind, {
      pass: definePass({name: 'p', features: [watcher], without: ['atlasFrame']}),
    });

    expect(seen).toEqual([['instancePosition', 'flatPlacement', 'textureColor', 'watcher']]);
    expect(() => new FeatureSpritesMaterial(kind, {pass: definePass({name: 'q', features: [refusing]})})).toThrow(
      'FeatureSpritesMaterial: feature "refusing" of pass "q": needs a grid',
    );
    material.dispose();
  });
});
