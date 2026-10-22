import {readFileSync, writeFileSync} from 'node:fs';
import {Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {graphSignature} from '../../testing/spriteGraph.js';
import type {SpriteKind} from '../defineSprite.js';
import type {SpritePass} from '../passes/definePass.js';
import {BillboardReflectionPass, ReflectionPass, ShadowPass} from '../passes/passPresets.js';
import {AnimatedSpriteKind, TexturedSpriteKind} from '../presets.js';
import {FeatureSpritesMaterial} from './FeatureSpritesMaterial.js';

// The graphs the preset kinds and the passes over them build, as graphSignature() writes them. A
// change to the graph of a preset feature, or a three bump that changes how its nodes are built,
// changes them; then write them anew with UPDATE_SPRITE_GRAPHS=1 and read the diff.
const FIXTURE = new URL('./fixtures/preset-graphs.json', import.meta.url);

const withImage = (width = 4, height = 4) => {
  const texture = new Texture();
  texture.image = {width, height} as unknown as HTMLImageElement;
  return texture;
};

const kinds: [string, SpriteKind, () => Record<string, Texture>][] = [
  ['TexturedSpriteKind', TexturedSpriteKind, () => ({colorMap: new Texture()})],
  ['AnimatedSpriteKind without an animsMap', AnimatedSpriteKind, () => ({colorMap: new Texture()})],
  ['AnimatedSpriteKind', AnimatedSpriteKind, () => ({colorMap: new Texture(), animsMap: withImage()})],
];
const passes: [string, SpritePass | undefined][] = [
  ['the sprites', undefined],
  ['ShadowPass', ShadowPass],
  ['ReflectionPass', ReflectionPass],
  ['BillboardReflectionPass', BillboardReflectionPass],
];

const graphsNow = (): Record<string, {position: string; color: string}> => {
  const graphs: Record<string, {position: string; color: string}> = {};
  for (const [kindName, kind, textures] of kinds) {
    for (const [passName, pass] of passes) {
      const material = new FeatureSpritesMaterial(kind, pass == null ? {textures: textures()} : {textures: textures(), pass});
      graphs[`${kindName}, ${passName}`] = {
        position: graphSignature(material.positionNode!),
        color: graphSignature(material.colorNode!),
      };
      material.dispose();
    }
  }
  return graphs;
};

describe('the preset kinds build the graphs of the fixture', () => {
  const now = graphsNow();
  if (process.env['UPDATE_SPRITE_GRAPHS'] === '1') writeFileSync(FIXTURE, `${JSON.stringify(now, null, 2)}\n`);
  const before = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, {position: string; color: string}>;

  test('every case of the fixture is built today, and no other', () => {
    expect(Object.keys(now)).toEqual(Object.keys(before));
  });

  for (const name of Object.keys(now)) {
    test(`${name}: the position graph and the color graph`, () => {
      expect(now[name]!.position).toBe(before[name]!.position);
      expect(now[name]!.color).toBe(before[name]!.color);
    });
  }
});
