import {describe, expect, test} from 'vitest';

import {TexturedSprites} from './TexturedSprites.js';

describe('TexturedSprites', () => {
  test('createSprite() takes a sprite from the sprite pool', () => {
    const sprites = new TexturedSprites(4);

    const sprite = sprites.createSprite();

    expect(sprite).toBeDefined();
    expect(sprites.spritePool.usedCount).toBe(1);
    expect(sprites.spritePool.containsVO(sprite!)).toBe(true);

    sprites.dispose();
  });

  test('the sprite of createSprite() writes through to the pool buffer', () => {
    const sprites = new TexturedSprites(4);

    const sprite = sprites.createSprite()!;
    sprite.setPosition(1, 2, 3);

    expect(sprites.spritePool.getVO(0)!.x).toBe(1);

    sprites.dispose();
  });

  test('freeSprite() gives a sprite back to the pool', () => {
    const sprites = new TexturedSprites(4);

    const sprite = sprites.createSprite()!;
    sprites.freeSprite(sprite);

    expect(sprites.spritePool.usedCount).toBe(0);

    sprites.dispose();
  });

  test('createSprite() answers undefined once the pool is full', () => {
    const sprites = new TexturedSprites(2);

    sprites.createSprite();
    sprites.createSprite();

    expect(sprites.createSprite()).toBeUndefined();

    sprites.dispose();
  });

  test('the convenience API answers nothing once the sprites are disposed', () => {
    const sprites = new TexturedSprites(4);
    const sprite = sprites.createSprite()!;

    sprites.dispose();

    expect(sprites.spritePool).toBeUndefined();
    expect(sprites.texture).toBeUndefined();
    expect(sprites.createSprite()).toBeUndefined();
    expect(() => sprites.freeSprite(sprite)).not.toThrow();
    expect(() => {
      sprites.texture = undefined;
    }).not.toThrow();
  });
});
