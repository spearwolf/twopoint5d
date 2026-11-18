import {TextureAtlas, TextureCoords} from '@spearwolf/twopoint5d';
import {describe, expect, it} from 'vitest';
import {atlasFrame} from './atlasFrame';

describe('atlasFrame', () => {
  const atlas = new TextureAtlas();
  const coords = new TextureCoords(0, 0, 16, 16);
  atlas.add('ship-00', coords);

  it('answers the frame of the name', () => {
    expect(atlasFrame(atlas, 'GalleryScene', 'ship-00')).toBe(atlas.frame('ship-00'));
    expect(atlasFrame(atlas, 'GalleryScene', 'ship-00').coords).toBe(coords);
  });

  it('throws for a frame the atlas lacks, with the subject first', () => {
    expect(() => atlasFrame(atlas, 'GalleryScene', 'ship-99')).toThrow(
      new Error('GalleryScene: the atlas has no frame "ship-99"'),
    );
  });

  it('writes a quote in the name escaped', () => {
    expect(() => atlasFrame(atlas, 'GalleryScene', 'a"b')).toThrow(new Error('GalleryScene: the atlas has no frame "a\\"b"'));
  });
});
