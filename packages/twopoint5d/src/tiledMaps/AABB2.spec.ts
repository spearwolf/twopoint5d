import assert from 'assert';

import {AABB2} from './AABB2.js';

describe('AABB2', () => {
  describe('create', () => {
    const aabb = new AABB2(-5, -8, 10, 16);

    it('top', () => assert.strictEqual(aabb.top, -8));
    it('left', () => assert.strictEqual(aabb.left, -5));
    it('width', () => assert.strictEqual(aabb.width, 10));
    it('height', () => assert.strictEqual(aabb.height, 16));
    it('right', () => assert.strictEqual(aabb.right, 5));
    it('bottom', () => assert.strictEqual(aabb.bottom, 8));
    it('centerX', () => assert.strictEqual(aabb.centerX, 0));
    it('centerY', () => assert.strictEqual(aabb.centerY, 0));
  });

  it('is', () => {
    expect(new AABB2(1, 2, 3, 4).is(1, 2, 3, 4)).toBeTruthy();
    expect(new AABB2(1, 2, 3, 4).is(666, 2, 3, 4)).toBeFalsy();
    expect(new AABB2(1, 2, 3, 4).is(1, 666, 3, 4)).toBeFalsy();
    expect(new AABB2(1, 2, 3, 4).is(1, 2, 666, 4)).toBeFalsy();
    expect(new AABB2(1, 2, 3, 4).is(1, 2, 3, 666)).toBeFalsy();
  });

  it('set', () => {
    expect(new AABB2().set(1, 2, 3, 4).is(1, 2, 3, 4)).toBeTruthy();
  });

  it('clone', () => {
    const aabb = new AABB2(5, 6, 7, 8);
    const clone = aabb.clone();
    expect(clone).not.toBe(aabb);
    expect(clone.is(5, 6, 7, 8)).toBeTruthy();
  });

  it('copy', () => {
    const copy = new AABB2().copy(new AABB2(7, 8, 9, 10));
    expect(copy.is(7, 8, 9, 10)).toBeTruthy();
  });

  describe('from', () => {
    it('without target', () => {
      const aabb = AABB2.from({left: 2, top: 3, width: 4, height: 5});
      expect(aabb).toBeInstanceOf(AABB2);
      expect(aabb.is(2, 3, 4, 5)).toBeTruthy();
    });
    it('with target', () => {
      const target = new AABB2();
      const aabb = AABB2.from({left: 2, top: 3, width: 4, height: 5}, target);
      expect(aabb).toBe(target);
      expect(aabb.is(2, 3, 4, 5)).toBeTruthy();
    });
  });

  describe('extend', () => {
    describe('not overlapping', () => {
      const aabb = new AABB2(0, 3, 10, 18);
      const other = new AABB2(20, 21, 3, 4);
      it('should return self', () => {
        expect(aabb.extend(other)).toBe(aabb);
      });
      it('left', () => {
        expect(aabb.left).toBe(0);
      });
      it('right', () => {
        expect(aabb.right).toBe(23);
      });
      it('top', () => {
        expect(aabb.top).toBe(3);
      });
      it('bottom', () => {
        expect(aabb.bottom).toBe(25);
      });
    });
    describe('intersecting', () => {
      const aabb = new AABB2(0, 3, 10, 18);
      const other = new AABB2(-5, 0, 6, 3);
      it('should return self', () => {
        expect(aabb.extend(other)).toBe(aabb);
      });
      it('left', () => {
        expect(aabb.left).toBe(-5);
      });
      it('right', () => {
        expect(aabb.right).toBe(10);
      });
      it('top', () => {
        expect(aabb.top).toBe(0);
      });
      it('bottom', () => {
        expect(aabb.bottom).toBe(21);
      });
    });
    describe('overlaps (inside)', () => {
      const aabb = new AABB2(0, 3, 10, 18);
      const other = new AABB2(1, 4, 7, 5);
      it('should return self', () => {
        expect(aabb.extend(other)).toBe(aabb);
      });
      it('left', () => {
        expect(aabb.left).toBe(0);
      });
      it('right', () => {
        expect(aabb.right).toBe(10);
      });
      it('top', () => {
        expect(aabb.top).toBe(3);
      });
      it('bottom', () => {
        expect(aabb.bottom).toBe(21);
      });
    });
    describe('overlaps', () => {
      const aabb = new AABB2(0, 3, 10, 18);
      const other = new AABB2(-10, -10, 100, 100);
      it('should return self', () => {
        expect(aabb.extend(other)).toBe(aabb);
      });
      it('left', () => {
        expect(aabb.left).toBe(-10);
      });
      it('right', () => {
        expect(aabb.right).toBe(90);
      });
      it('top', () => {
        expect(aabb.top).toBe(-10);
      });
      it('bottom', () => {
        expect(aabb.bottom).toBe(90);
      });
    });
  });

  describe('setters', () => {
    it('centerX', () => {
      const aabb = new AABB2(0, 3, 10, 18);
      aabb.centerX = 6;
      expect(aabb).toMatchObject({
        left: 1,
        right: 11,
        width: 10,
        centerX: 6,
      });
    });
    it('centerY', () => {
      const aabb = new AABB2(0, 3, 10, 18);
      aabb.centerY = -5;
      expect(aabb).toMatchObject({
        top: -14,
        bottom: 4,
        height: 18,
        centerY: -5,
      });
    });
  });

  describe('isEqual', () => {
    it('self', () => {
      const aabb = new AABB2(0, 3, 10, 18);
      expect(aabb.isEqual(aabb)).toBeTruthy();
    });
    it('same values', () => {
      const aabb0 = new AABB2(0, 3, 10, 18);
      const aabb1 = new AABB2(0, 3, 10, 18);
      expect(aabb0.isEqual(aabb1)).toBeTruthy();
    });
    it('different values', () => {
      expect(new AABB2(0, 3, 10, 18).isEqual(new AABB2(666, 3, 10, 18))).toBeFalsy();
      expect(new AABB2(0, 3, 10, 18).isEqual(new AABB2(0, 666, 10, 18))).toBeFalsy();
      expect(new AABB2(0, 3, 10, 18).isEqual(new AABB2(0, 3, 666, 18))).toBeFalsy();
      expect(new AABB2(0, 3, 10, 18).isEqual(new AABB2(0, 3, 10, 666))).toBeFalsy();
    });
  });

  it('isInside', () => {
    expect(new AABB2(0, 0, 10, 10).isInside(1, 1)).toBeTruthy();
    expect(new AABB2(0, 0, 10, 10).isInside(0, 0)).toBeTruthy();
    expect(new AABB2(0, 0, 10, 10).isInside(10, 10)).toBeFalsy();
    expect(new AABB2(0, 0, 10, 10).isInside(11, 10)).toBeFalsy();
  });

  it('isInsideAABB', () => {
    expect(new AABB2(0, 0, 10, 10).isInsideAABB(new AABB2(2, 2, 4, 4))).toBeTruthy();
    expect(new AABB2(0, 0, 10, 10).isInsideAABB(new AABB2(0, 0, 4, 4))).toBeTruthy();
    expect(new AABB2(0, 0, 10, 10).isInsideAABB(new AABB2(0, 0, 10, 10))).toBeTruthy();
    expect(new AABB2(0, 0, 10, 10).isInsideAABB(new AABB2(0, 0, 11, 10))).toBeFalsy();
    expect(new AABB2(0, 0, 10, 10).isInsideAABB(new AABB2(0, 0, 10, 12))).toBeFalsy();
    expect(new AABB2(0, 0, 10, 10).isInsideAABB(new AABB2(-10, -10, 100, 100))).toBeFalsy();
    expect(new AABB2(-10, -10, 100, 100).isInsideAABB(new AABB2(0, 0, 10, 10))).toBeTruthy();
  });

  describe('quadrant helpers', () => {
    const A = new AABB2(-20, -20, 10, 10);
    const B = new AABB2(-5, -20, 10, 10);
    const C = new AABB2(10, -20, 10, 10);
    const D = new AABB2(-20, -5, 10, 10);
    const E = new AABB2(-10, -10, 10, 10);
    const F = new AABB2(-5, -5, 10, 10);
    const G = new AABB2(0, -10, 10, 10);
    const H = new AABB2(10, -5, 10, 10);
    const I = new AABB2(-10, 0, 10, 10);
    const J = new AABB2(0, 0, 10, 10);
    const K = new AABB2(-20, 10, 10, 10);
    const L = new AABB2(-5, 10, 10, 10);
    const M = new AABB2(10, 10, 10, 10);

    it('isNorthWest(A)', () => assert(A.isNorthWest(0, 0)));
    it('isNorthEast(A)', () => assert(!A.isNorthEast(0, 0)));
    it('isSouthEast(A)', () => assert(!A.isSouthEast(0, 0)));
    it('isSouthWest(A)', () => assert(!A.isSouthWest(0, 0)));

    it('isNorthWest(B)', () => assert(B.isNorthWest(0, 0)));
    it('isNorthEast(B)', () => assert(B.isNorthEast(0, 0)));
    it('isSouthEast(B)', () => assert(!B.isSouthEast(0, 0)));
    it('isSouthWest(B)', () => assert(!B.isSouthWest(0, 0)));

    it('isNorthWest(C)', () => assert(!C.isNorthWest(0, 0)));
    it('isNorthEast(C)', () => assert(C.isNorthEast(0, 0)));
    it('isSouthEast(C)', () => assert(!C.isSouthEast(0, 0)));
    it('isSouthWest(C)', () => assert(!C.isSouthWest(0, 0)));

    it('isNorthWest(D)', () => assert(D.isNorthWest(0, 0)));
    it('isNorthEast(D)', () => assert(!D.isNorthEast(0, 0)));
    it('isSouthEast(D)', () => assert(!D.isSouthEast(0, 0)));
    it('isSouthWest(D)', () => assert(D.isSouthWest(0, 0)));

    it('isNorthWest(E)', () => assert(E.isNorthWest(0, 0)));
    it('isNorthEast(E)', () => assert(!E.isNorthEast(0, 0)));
    it('isSouthEast(E)', () => assert(!E.isSouthEast(0, 0)));
    it('isSouthWest(E)', () => assert(!E.isSouthWest(0, 0)));

    it('isNorthWest(F)', () => assert(F.isNorthWest(0, 0)));
    it('isNorthEast(F)', () => assert(F.isNorthEast(0, 0)));
    it('isSouthEast(F)', () => assert(F.isSouthEast(0, 0)));
    it('isSouthWest(F)', () => assert(F.isSouthWest(0, 0)));

    it('isNorthWest(G)', () => assert(!G.isNorthWest(0, 0)));
    it('isNorthEast(G)', () => assert(G.isNorthEast(0, 0)));
    it('isSouthEast(G)', () => assert(!G.isSouthEast(0, 0)));
    it('isSouthWest(G)', () => assert(!G.isSouthWest(0, 0)));

    it('isNorthWest(H)', () => assert(!H.isNorthWest(0, 0)));
    it('isNorthEast(H)', () => assert(H.isNorthEast(0, 0)));
    it('isSouthEast(H)', () => assert(H.isSouthEast(0, 0)));
    it('isSouthWest(H)', () => assert(!H.isSouthWest(0, 0)));

    it('isNorthWest(I)', () => assert(!I.isNorthWest(0, 0)));
    it('isNorthEast(I)', () => assert(!I.isNorthEast(0, 0)));
    it('isSouthEast(I)', () => assert(!I.isSouthEast(0, 0)));
    it('isSouthWest(I)', () => assert(I.isSouthWest(0, 0)));

    it('isNorthWest(J)', () => assert(!J.isNorthWest(0, 0)));
    it('isNorthEast(J)', () => assert(!J.isNorthEast(0, 0)));
    it('isSouthEast(J)', () => assert(J.isSouthEast(0, 0)));
    it('isSouthWest(J)', () => assert(!J.isSouthWest(0, 0)));

    it('isNorthWest(K)', () => assert(!K.isNorthWest(0, 0)));
    it('isNorthEast(K)', () => assert(!K.isNorthEast(0, 0)));
    it('isSouthEast(K)', () => assert(!K.isSouthEast(0, 0)));
    it('isSouthWest(K)', () => assert(K.isSouthWest(0, 0)));

    it('isNorthWest(L)', () => assert(!L.isNorthWest(0, 0)));
    it('isNorthEast(L)', () => assert(!L.isNorthEast(0, 0)));
    it('isSouthEast(L)', () => assert(L.isSouthEast(0, 0)));
    it('isSouthWest(L)', () => assert(L.isSouthWest(0, 0)));

    it('isNorthWest(M)', () => assert(!M.isNorthWest(0, 0)));
    it('isNorthEast(M)', () => assert(!M.isNorthEast(0, 0)));
    it('isSouthEast(M)', () => assert(M.isSouthEast(0, 0)));
    it('isSouthWest(M)', () => assert(!M.isSouthWest(0, 0)));
  });

  describe('isIntersection()', () => {
    const aabb = new AABB2(-10, -10, 20, 20);

    it('a', () => assert(!aabb.isIntersecting(new AABB2(-20, -20, 10, 10))));
    it('b', () => assert(!aabb.isIntersecting(new AABB2(-5, -20, 10, 10))));
    it('c', () => assert(!aabb.isIntersecting(new AABB2(10, -20, 10, 10))));
    it('d', () => assert(aabb.isIntersecting(new AABB2(-15, -15, 10, 10))));
    it('e', () => assert(aabb.isIntersecting(new AABB2(-5, -15, 10, 10))));
    it('f', () => assert(aabb.isIntersecting(new AABB2(5, -15, 10, 10))));
    it('g', () => assert(!aabb.isIntersecting(new AABB2(-20, -5, 10, 10))));
    it('h', () => assert(aabb.isIntersecting(new AABB2(-15, -5, 10, 10))));
    it('i', () => assert(aabb.isIntersecting(new AABB2(-5, -5, 10, 10))));
    it('j', () => assert(aabb.isIntersecting(new AABB2(5, -5, 10, 10))));
    it('K', () => assert(!aabb.isIntersecting(new AABB2(10, -5, 10, 10))));
    it('l', () => assert(aabb.isIntersecting(new AABB2(-100, -2, 200, 4))));
    it('m', () => assert(aabb.isIntersecting(new AABB2(-2, -100, 4, 200))));
    it('n', () => assert(aabb.isIntersecting(new AABB2(-50, -50, 100, 100))));
    it('o', () => assert(aabb.isIntersecting(new AABB2(-15, 5, 10, 10))));
    it('p', () => assert(aabb.isIntersecting(new AABB2(-5, 5, 10, 10))));
    it('q', () => assert(aabb.isIntersecting(new AABB2(5, 5, 10, 10))));
    it('r', () => assert(!aabb.isIntersecting(new AABB2(-20, 10, 10, 10))));
    it('s', () => assert(!aabb.isIntersecting(new AABB2(-5, 10, 10, 10))));
    it('t', () => assert(!aabb.isIntersecting(new AABB2(10, 10, 10, 10))));
    it('u', () => assert(aabb.isIntersecting(new AABB2(-100, -2, 200, 50))));
    it('v', () => assert(aabb.isIntersecting(new AABB2(-100, -48, 200, 50))));
    it('w', () => assert(aabb.isIntersecting(new AABB2(-48, -100, 50, 200))));
    it('x', () => assert(aabb.isIntersecting(new AABB2(2, -100, 50, 200))));
  });
});
