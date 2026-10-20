import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';

import {prepareSpriteFrame} from '../sprites/features/AtlasFrame.js';
import {frameTrimMargins} from './frameTrimMargins.js';
import {isAtlasJsonResponse} from './isAtlasJsonResponse.js';
import {TextureCoords} from './TextureCoords.js';
import {TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';

// a real export of free-tex-packer-core 0.3.9; `fixtures/free-tex-packer/README.md` says how it was made
const fixture = (name: string): TexturePackerJsonData =>
  JSON.parse(readFileSync(new URL(`./fixtures/free-tex-packer/${name}`, import.meta.url), 'utf8'));

const hash = fixture('sheet-hash.json');
const array = fixture('sheet-array.json');

const TURNED = TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL;

describe('TexturePackerJson.parse() of a free-tex-packer export', () => {
  test('reads the JSON Hash and the JSON Array export alike', () => {
    const [fromHash] = TexturePackerJson.parse(hash);
    const [fromArray] = TexturePackerJson.parse(array);

    expect(fromHash.frameNames()).toEqual(['banner.png', 'gem.png', 'hero.png']);
    expect(fromArray.frameNames()).toEqual(fromHash.frameNames());
    for (const name of fromHash.frameNames()) {
      expect(fromArray.frame(name)!.coords.getTexCoords()).toEqual(fromHash.frame(name)!.coords.getTexCoords());
      expect(fromArray.frame(name)!.coords.flip).toBe(fromHash.frame(name)!.coords.flip);
    }
  });

  test.each([
    ['JSON Hash', hash],
    ['JSON Array', array],
  ])('%s: an upright untrimmed frame', (_, data) => {
    const [atlas] = TexturePackerJson.parse(data);

    const banner = atlas.frame('banner.png')!;

    expect(banner.coords).toMatchObject({x: 0, y: 0, width: 24, height: 3, flip: 0});
    expect(frameTrimMargins(banner.data)).toEqual([0, 0, 0, 0]);
  });

  test.each([
    ['JSON Hash', hash],
    ['JSON Array', array],
  ])('%s: a rotated frame lies turned in the sheet, its area h × w', (_, data) => {
    const [atlas] = TexturePackerJson.parse(data);

    const gem = atlas.frame('gem.png')!;

    expect(gem.coords).toMatchObject({x: 0, y: 3, width: 6, height: 4, flip: TURNED});
    expect(frameTrimMargins(gem.data)).toEqual([0, 0, 0, 0]);
  });

  test.each([
    ['JSON Hash', hash],
    ['JSON Array', array],
  ])('%s: a rotated and trimmed frame keeps its trim margins', (_, data) => {
    const [atlas] = TexturePackerJson.parse(data);

    const hero = atlas.frame('hero.png')!;

    expect(hero.coords).toMatchObject({x: 6, y: 3, width: 6, height: 4, flip: TURNED});
    frameTrimMargins(hero.data).forEach((margin, i) => expect(margin).toBeCloseTo([2 / 9, 1 / 9, 3 / 9, 2 / 9][i]!, 12));

    const prepared = prepareSpriteFrame(hero);
    expect(prepared.texFlipDiagonal).toBe(1);
    expect(prepared.texTrim).toEqual(frameTrimMargins(hero.data));
  });

  test('keeps the meta of the packer as it was given', () => {
    const [, meta] = TexturePackerJson.parse(hash);

    expect(meta).toMatchObject({image: 'sheet.png', size: {w: 24, h: 7}, app: 'https://github.com/odrick/free-tex-packer-core'});
  });

  test('the loaders take both exports for an atlas json', () => {
    expect(isAtlasJsonResponse(hash)).toBe(true);
    expect(isAtlasJsonResponse(array)).toBe(true);
  });
});
