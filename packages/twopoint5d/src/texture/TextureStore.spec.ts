import {describe, expect, test} from 'vitest';
import {TextureStore} from './TextureStore.js';

describe('TextureStore', () => {
  test('create', () => {
    const store = new TextureStore();
    expect(store).toBeInstanceOf(TextureStore);
  });

  test('on', () => {
    const store = new TextureStore();

    const wait = store.on('foo', ['atlas', 'imageCoords'], ([atlas, coords]) => {
      atlas.randomFrame();
      coords.flipDiagonal();
    });

    expect(wait).toBeInstanceOf(Function);
    wait();
  });
});
