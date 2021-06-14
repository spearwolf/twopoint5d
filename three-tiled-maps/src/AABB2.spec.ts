import assert from 'assert';

import {AABB2} from './AABB2';

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
