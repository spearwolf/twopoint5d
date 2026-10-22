import {readdirSync, readFileSync} from 'node:fs';
import {texture, vec4} from 'three/tsl';
import {Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {asTextureNode} from './typedNodes.js';

// tsc types the TSL expressions of a stage by itself, and a cast through unknown switches that check
// off; where @types/three declares less than a node is, the helpers of typedNodes.ts stand in
const STAGE_DIRS = ['./features/', './passes/'];

const castsIn = (dir: URL): string[] =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.bench.ts'))
    .flatMap((name) =>
      readFileSync(new URL(name, dir), 'utf8')
        .split('\n')
        .flatMap((line, i) => (line.includes('as unknown as') ? [`${name}:${i + 1}`] : [])),
    );

describe('the shader stages', () => {
  test('no feature and no pass casts a node through unknown', () => {
    const found = STAGE_DIRS.flatMap((dir) => castsIn(new URL(dir, import.meta.url)).map((at) => `${dir.slice(2)}${at}`));
    expect(found).toEqual([]);
  });
});

describe('asTextureNode()', () => {
  test('answers the texture node sample() answers, and refuses any other node', () => {
    const lookup = texture(new Texture());
    expect(asTextureNode(lookup)).toBe(lookup);
    expect(() => asTextureNode(vec4(0, 0, 0, 1))).toThrow(
      new TypeError('asTextureNode: the node is no TextureNode — sample() of a stage context answers one'),
    );
  });
});
