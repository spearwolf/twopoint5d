import {TextureCoords} from './TextureCoords';

describe('TextureCoords', () => {
  describe('construction', () => {
    test('without arguments', () => {
      const texCoords = new TextureCoords();
      expect(texCoords).toBeDefined();
      expect(texCoords.x).toBe(0);
      expect(texCoords.y).toBe(0);
      expect(texCoords.width).toBe(0);
      expect(texCoords.height).toBe(0);
      expect(texCoords.parent).toBeUndefined();
    });

    test('with coords', () => {
      const texCoords = new TextureCoords(10, 20, 100, 200);
      expect(texCoords).toBeDefined();
      expect(texCoords.x).toBe(10);
      expect(texCoords.y).toBe(20);
      expect(texCoords.width).toBe(100);
      expect(texCoords.height).toBe(200);
      expect(texCoords.parent).toBeUndefined();

      expect(new TextureCoords(1)).toMatchObject({
        x: 1,
        y: 0,
        width: 0,
        height: 0,
      });
      expect(new TextureCoords(1, 2)).toMatchObject({
        x: 1,
        y: 2,
        width: 0,
        height: 0,
      });
      expect(new TextureCoords(1, 2, 3)).toMatchObject({
        x: 1,
        y: 2,
        width: 3,
        height: 0,
      });
      expect(new TextureCoords(1, 2, 3, 4)).toMatchObject({
        x: 1,
        y: 2,
        width: 3,
        height: 4,
      });
    });

    test('with parent and coords', () => {
      const parent = new TextureCoords();
      const texCoords = new TextureCoords(parent, 10, 20, 100, 200);
      expect(texCoords).toBeDefined();
      expect(texCoords.x).toBe(10);
      expect(texCoords.y).toBe(20);
      expect(texCoords.width).toBe(100);
      expect(texCoords.height).toBe(200);
      expect(texCoords.parent).toBe(parent);

      expect(new TextureCoords(parent, 1)).toMatchObject({
        parent,
        x: 1,
        y: 0,
        width: 0,
        height: 0,
      });
      expect(new TextureCoords(parent, 1, 2)).toMatchObject({
        parent,
        x: 1,
        y: 2,
        width: 0,
        height: 0,
      });
      expect(new TextureCoords(parent, 1, 2, 3)).toMatchObject({
        parent,
        x: 1,
        y: 2,
        width: 3,
        height: 0,
      });
      expect(new TextureCoords(parent, 1, 2, 3, 4)).toMatchObject({
        parent,
        x: 1,
        y: 2,
        width: 3,
        height: 4,
      });
    });

    test('clone()', () => {
      const parent = new TextureCoords();
      const texCoords0 = new TextureCoords(parent, 1, 2, 3, 4);
      const texCoords = texCoords0.clone();

      expect(texCoords).toBeDefined();
      expect(texCoords).not.toBe(texCoords0);
      expect(texCoords.parent).toBe(parent);

      expect(texCoords).toMatchObject({
        x: texCoords0.x,
        y: texCoords0.y,
        width: texCoords0.width,
        height: texCoords0.height,
        flip: texCoords0.flip,
      });
    });
  });
  describe('root', () => {
    test('i am root', () => {
      const texCoords = new TextureCoords();
      expect(texCoords.parent).toBeUndefined();
      expect(texCoords.root).toBe(texCoords);
    });

    test('parent is root', () => {
      const parent = new TextureCoords();
      const texCoords = new TextureCoords(parent);
      expect(texCoords.parent).toBe(parent);
      expect(texCoords.root).toBe(parent);
    });

    test('root is root', () => {
      const root = new TextureCoords();
      const parent = new TextureCoords(root);
      const texCoords = new TextureCoords(parent);
      expect(texCoords.parent).toBe(parent);
      expect(texCoords.root).toBe(root);
    });
  });
  describe('s,t,u,v', () => {
    test('parentless', () => {
      expect(new TextureCoords(0, 0, 320, 240)).toMatchObject({
        x: 0,
        y: 0,
        width: 320,
        height: 240,
        s: 0,
        t: 0,
        s1: 1,
        t1: 1,
      });
    });
    test('has parent', () => {
      expect(
        new TextureCoords(new TextureCoords(0, 0, 320, 160), 9, 11, 300, 140),
      ).toMatchObject({
        x: 9,
        y: 11,
        width: 300,
        height: 140,
        s: 9 / 320,
        t: 11 / 160,
        s1: (300 + 9) / 320,
        t1: (140 + 11) / 160,
      });
    });
    test('has parents', () => {
      const root = new TextureCoords(0, 0, 320, 160);
      const parent = new TextureCoords(root, 4, 6, 200, 120);
      expect(new TextureCoords(parent, 20, 10, 100, 50)).toMatchObject({
        x: 20,
        y: 10,
        width: 100,
        height: 50,
        s: (4 + 20) / 320,
        t: (6 + 10) / 160,
        s1: (4 + 20 + 100) / 320,
        t1: (6 + 10 + 50) / 160,
      });
    });
  });
  describe('flip', () => {
    test('horizontal', () => {
      const root = new TextureCoords(0, 0, 320, 160);
      const parent = new TextureCoords(root, 4, 6, 200, 120);
      const tex = new TextureCoords(parent, 20, 10, 100, 50);
      const tex2 = tex.clone().flipHorizontal();

      expect(tex2).not.toBe(tex);
      expect(tex2).toMatchObject({
        x: tex.x,
        y: tex.y,
        width: tex.width,
        height: tex.height,
        s: tex.s1,
        t: tex.t,
        s1: tex.s,
        t1: tex.t1,
      });
    });
    test('vertical', () => {
      const root = new TextureCoords(0, 0, 320, 160);
      const parent = new TextureCoords(root, 4, 6, 200, 120);
      const tex = new TextureCoords(parent, 20, 10, 100, 50);
      const tex2 = tex.clone().flipVertical();

      expect(tex2).not.toBe(tex);
      expect(tex2).toMatchObject({
        x: tex.x,
        y: tex.y,
        width: tex.width,
        height: tex.height,
        s: tex.s,
        t: tex.t1,
        s1: tex.s1,
        t1: tex.t,
      });
    });
    test('diagonal', () => {
      const root = new TextureCoords(0, 0, 320, 160);
      const parent = new TextureCoords(root, 4, 6, 200, 120);
      const tex = new TextureCoords(parent, 20, 10, 100, 50);
      const tex2 = tex.clone().flipDiagonal();

      expect(tex2).not.toBe(tex);
      expect(tex2).toMatchObject({
        x: tex.x,
        y: tex.y,
        width: tex.width,
        height: tex.height,
        s: tex.t,
        t: tex.s,
        s1: tex.t1,
        t1: tex.s1,
      });
    });
  });
});
