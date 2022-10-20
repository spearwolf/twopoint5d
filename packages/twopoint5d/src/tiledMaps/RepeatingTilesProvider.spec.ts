import {RepeatingTilesProvider} from './RepeatingTilesProvider';

describe('RepeatingTilesProvider', () => {
  describe('new', () => {
    test('without arguments', () => {
      const tiles = new RepeatingTilesProvider();
      expect(tiles).toBeDefined();
      expect(tiles.tileIds).toEqual([[]]);
      expect(tiles.limitToAxis).toBe('none');
    });
    test('with number', () => {
      const tiles = new RepeatingTilesProvider(7);
      expect(tiles).toBeDefined();
      expect(tiles.tileIds).toEqual([[7]]);
      expect(tiles.limitToAxis).toBe('none');
    });
    test('with number[]', () => {
      const tiles = new RepeatingTilesProvider([1, 2, 3]);
      expect(tiles).toBeDefined();
      expect(tiles.tileIds).toEqual([[1, 2, 3]]);
      expect(tiles.limitToAxis).toBe('none');
    });
    test('with number[][', () => {
      const tiles = new RepeatingTilesProvider([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(tiles).toBeDefined();
      expect(tiles.tileIds).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(tiles.limitToAxis).toBe('none');
    });
    test('with limitToAxis', () => {
      expect(new RepeatingTilesProvider(1, 'horizontal').limitToAxis).toBe('horizontal');
      expect(new RepeatingTilesProvider(1, 'vertical').limitToAxis).toBe('vertical');
    });
  });
  describe('getTileIdAt()', () => {
    test('vertical', () => {
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'vertical',
        ).getTileIdAt(0, 0),
      ).toEqual(1);
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'vertical',
        ).getTileIdAt(1, 11),
      ).toEqual(4);
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'vertical',
        ).getTileIdAt(0, -5),
      ).toEqual(3);
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'vertical',
        ).getTileIdAt(-5, 0),
      ).toEqual(0);
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'vertical',
        ).getTileIdAt(2, 9),
      ).toEqual(0);
    });
    test('horizontal', () => {
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'horizontal',
        ).getTileIdAt(0, 0),
      ).toEqual(1);
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'horizontal',
        ).getTileIdAt(10, 1),
      ).toEqual(3);
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'horizontal',
        ).getTileIdAt(-5, 0),
      ).toEqual(2);
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'horizontal',
        ).getTileIdAt(0, -5),
      ).toEqual(0);
      expect(
        new RepeatingTilesProvider(
          [
            [1, 2],
            [3, 4],
          ],
          'horizontal',
        ).getTileIdAt(9, 2),
      ).toEqual(0);
    });
    test('none', () => {
      expect(
        new RepeatingTilesProvider([
          [1, 2],
          [3, 4],
        ]).getTileIdAt(0, 0),
      ).toEqual(1);
      expect(
        new RepeatingTilesProvider([
          [1, 2],
          [3, 4],
        ]).getTileIdAt(-1, 0),
      ).toEqual(2);
      expect(
        new RepeatingTilesProvider([
          [1, 2],
          [3, 4],
        ]).getTileIdAt(7, -4),
      ).toEqual(2);
    });
  });
  describe('getTileIdsWithin()', () => {
    test('without target returns a new typed array', () => {
      const provider = new RepeatingTilesProvider();
      const tiles = provider.getTileIdsWithin(0, 0, 10, 5);
      expect(tiles).toBeInstanceOf(Uint32Array);
      expect(tiles.length).toBe(50);
    });
    test('with target argument returns the target', () => {
      const provider = new RepeatingTilesProvider();
      const target = new Uint32Array(50);
      const tiles = provider.getTileIdsWithin(0, 0, 10, 5, target);
      expect(tiles).toBe(target);
    });
    describe('vertical', () => {
      test('right outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(1, 'vertical').getTileIdsWithin(3, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 0,
          0, 0, 0,
        ]);
      });
      test('left outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2], 'vertical').getTileIdsWithin(-3, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 0,
          0, 0, 0,
        ]);
      });
      test('1x1 pattern inside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(1, 'vertical').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 0, 0,
          1, 0, 0,
        ]);
      });
      test('1x3 pattern inside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([[1],[2],[3]], 'vertical').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 0, 0,
          2, 0, 0,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([[1],[2],[3]], 'vertical').getTileIdsWithin(0, 2, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          3, 0, 0,
          1, 0, 0,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([[1],[2],[3]], 'vertical').getTileIdsWithin(0, -2, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          2, 0, 0,
          3, 0, 0,
        ]);
      });
      test('2x1 pattern inside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2], 'vertical').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 0,
          1, 2, 0,
        ]);
      });
      test('3x1 pattern inside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3], 'vertical').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          1, 2, 3,
        ]);
      });
      test('4x1 pattern in-outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4], 'vertical').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          1, 2, 3,
        ]);
        // prettier-ignore
        expect(
        Array.from(
          new RepeatingTilesProvider([1, 2, 3, 4], 'vertical').getTileIdsWithin(-1, 0, 3, 2, new Uint32Array(6).fill(666)),
        ),
      ).toEqual([
        0, 1, 2,
        0, 1, 2,
      ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4], 'vertical').getTileIdsWithin(-2, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 1,
          0, 0, 1,
        ]);
      });
      test('4x4 pattern in-outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
              'vertical',
            ).getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          5, 6, 7,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
              'vertical',
            ).getTileIdsWithin(-1, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 13, 14,
          0, 1, 2,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
              'vertical',
            ).getTileIdsWithin(-2, 2, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 9,
          0, 0, 13,
        ]);
      });
    });
    describe('horizontal', () => {
      test('top outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(1, 'horizontal').getTileIdsWithin(0, -2, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 0,
          0, 0, 0,
        ]);
      });
      test('bottom outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2], 'horizontal').getTileIdsWithin(0, 2, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 0,
          0, 0, 0,
        ]);
      });
      test('1x1 pattern inside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(1, 'horizontal').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 1, 1,
          0, 0, 0,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(1, 'horizontal').getTileIdsWithin(0, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 0,
          1, 1, 1,
        ]);
      });
      test('2x1 pattern inside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2], 'horizontal').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 1,
          0, 0, 0,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2], 'horizontal').getTileIdsWithin(-1, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 0,
          2, 1, 2,
        ]);
      });
      test('4x1 pattern in-outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4], 'horizontal').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          0, 0, 0,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4], 'horizontal').getTileIdsWithin(2, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 0,
          3, 4, 1,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4], 'horizontal').getTileIdsWithin(-3, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 0,
          2, 3, 4,
        ]);
      });
      test('4x4 pattern inside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
              'horizontal',
            ).getTileIdsWithin(-4, 0, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          1, 2, 3, 4, 1, 2,
          5, 6, 7, 8, 5, 6,
          9, 10, 11, 12, 9, 10,
          13, 14, 15, 16, 13, 14,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
              'horizontal',
            ).getTileIdsWithin(6, -1, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          0, 0, 0, 0, 0, 0,
          3, 4, 1, 2, 3, 4,
          7, 8, 5, 6, 7, 8,
          11, 12, 9, 10, 11, 12,
          15, 16, 13, 14, 15, 16,
          0, 0, 0, 0, 0, 0,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1],
                [5],
                [9],
                [13],
              ],
              'horizontal',
            ).getTileIdsWithin(20, -3, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          1, 1, 1, 1, 1, 1,
          5, 5, 5, 5, 5, 5,
          9, 9, 9, 9, 9, 9,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
              'horizontal',
            ).getTileIdsWithin(2, -3, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          3, 4, 1, 2, 3, 4,
          7, 8, 5, 6, 7, 8,
          11, 12, 9, 10, 11, 12,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
              'horizontal',
            ).getTileIdsWithin(2, 2, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          11, 12, 9, 10, 11, 12,
          15, 16, 13, 14, 15, 16,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
        ]);
      });
      test('4x4 pattern in-outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
              'horizontal',
            ).getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          5, 6, 7,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
              'horizontal',
            ).getTileIdsWithin(-2, 1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          7, 8, 5,
          11, 12, 9,
        ]);
      });
    });
    describe('none', () => {
      test('1x1 pattern', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(1).getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 1, 1,
          1, 1, 1,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(1).getTileIdsWithin(8, -11, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 1, 1,
          1, 1, 1,
        ]);
      });
      test('2x1 pattern inside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2]).getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 1,
          1, 2, 1,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2]).getTileIdsWithin(-3, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          2, 1, 2,
          2, 1, 2,
        ]);
      });
      test('4x1 pattern in-outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4]).getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          1, 2, 3,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4]).getTileIdsWithin(2, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          3, 4, 1,
          3, 4, 1,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4]).getTileIdsWithin(-3, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          2, 3, 4,
          2, 3, 4,
        ]);
      });
      test('4x4 pattern inside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
            ).getTileIdsWithin(-4, 0, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          1, 2, 3, 4, 1, 2,
          5, 6, 7, 8, 5, 6,
          9, 10, 11, 12, 9, 10,
          13, 14, 15, 16, 13, 14,
          1, 2, 3, 4, 1, 2,
          5, 6, 7, 8, 5, 6,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
            ).getTileIdsWithin(6, -1, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          15, 16, 13, 14, 15, 16,
          3, 4, 1, 2, 3, 4,
          7, 8, 5, 6, 7, 8,
          11, 12, 9, 10, 11, 12,
          15, 16, 13, 14, 15, 16,
          3, 4, 1, 2, 3, 4,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1],
                [5],
                [9],
                [13],
              ],
            ).getTileIdsWithin(20, -3, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          5, 5, 5, 5, 5, 5,
          9, 9, 9, 9, 9, 9,
          13, 13, 13, 13, 13, 13,
          1, 1, 1, 1, 1, 1,
          5, 5, 5, 5, 5, 5,
          9, 9, 9, 9, 9, 9,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
            ).getTileIdsWithin(2, -3, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          7, 8, 5, 6, 7, 8,
          11, 12, 9, 10, 11, 12,
          15, 16, 13, 14, 15, 16,
          3, 4, 1, 2, 3, 4,
          7, 8, 5, 6, 7, 8,
          11, 12, 9, 10, 11, 12,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
            ).getTileIdsWithin(2, 2, 6, 6, new Uint32Array(36).fill(666)),
          ),
        ).toEqual([
          11, 12, 9, 10, 11, 12,
          15, 16, 13, 14, 15, 16,
          3, 4, 1, 2, 3, 4,
          7, 8, 5, 6, 7, 8,
          11, 12, 9, 10, 11, 12,
          15, 16, 13, 14, 15, 16,
        ]);
      });
      test('4x4 pattern in-outside', () => {
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
            ).getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          5, 6, 7,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
            ).getTileIdsWithin(-2, 1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          7, 8, 5,
          11, 12, 9,
        ]);
        // prettier-ignore
        expect(
          Array.from(
            new RepeatingTilesProvider(
              [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
              ],
            ).getTileIdsWithin(1, 1, 2, 2, new Uint32Array(4).fill(666)),
          ),
        ).toEqual([
          6, 7,
          10, 11,
        ]);
      });
    });
  });
});
