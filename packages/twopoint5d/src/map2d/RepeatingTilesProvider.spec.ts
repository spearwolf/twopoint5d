import {describe, expect, test} from 'vitest';
import type {LimitToAxisType} from './RepeatingTilesProvider.js';
import {RepeatingTilesProvider} from './RepeatingTilesProvider.js';

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
    test('a shape it does not recognize gets a pattern without cells', () => {
      expect(new RepeatingTilesProvider([] as number[]).tileIds).toEqual([[]]);
      expect(new RepeatingTilesProvider(['a'] as unknown as number[]).tileIds).toEqual([[]]);
    });
    test('with limitToAxis', () => {
      expect(new RepeatingTilesProvider(1, 'horizontal').limitToAxis).toBe('horizontal');
      expect(new RepeatingTilesProvider(1, 'vertical').limitToAxis).toBe('vertical');
    });
    test('rejects a pattern whose rows are not all the same length', () => {
      expect(() => new RepeatingTilesProvider([[1, 2], [3]])).toThrow(/row 1/);

      const tiles = new RepeatingTilesProvider([
        [1, 2],
        [3, 4],
      ]);
      expect(() => {
        tiles.tileIds = [[1, 2], [3]];
      }).toThrow(/row 1/);
      expect(tiles.tileIds).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });
  describe('tile ids', () => {
    test.each([
      ['1.5', [[1.5, NaN, -1]], 0, 0],
      ['NaN', [[1, NaN, -1]], 0, 1],
      [
        '-1',
        [
          [1, 2],
          [3, -1],
        ],
        1,
        1,
      ],
      ['4294967296', [[4294967296]], 0, 0],
      ['"1"', [['1']], 0, 0],
    ])(
      'refuses a tile id that is no whole number from 0 to 4294967295, naming row, column and value, and keeps its pattern: %s',
      (shown, pattern, row, col) => {
        const tiles = new RepeatingTilesProvider([[1, 2]]);
        const assign = () => {
          tiles.tileIds = pattern as number[][];
        };

        expect(assign).toThrow(RangeError);
        expect(assign).toThrow(
          `RepeatingTilesProvider: a tile id is a whole number from 0 to 4294967295, but row ${row}, column ${col} holds ${shown}`,
        );
        expect(tiles.tileIds).toEqual([[1, 2]]);
        expect(tiles.getTileIdAt(0, 0)).toBe(1);
        expect(Array.from(tiles.getTileIdsWithin(0, 0, 2, 1))).toEqual([1, 2]);
      },
    );

    test('takes 0 and 4294967295', () => {
      const tiles = new RepeatingTilesProvider([[0, 4294967295]]);

      expect(tiles.getTileIdAt(1, 0)).toBe(4294967295);
      expect(Array.from(tiles.getTileIdsWithin(0, 0, 2, 1))).toEqual([0, 4294967295]);
    });

    test('new RepeatingTilesProvider(NaN) throws', () => {
      expect(() => new RepeatingTilesProvider(NaN)).toThrow(
        new RangeError('RepeatingTilesProvider: a tile id is a whole number from 0 to 4294967295, but row 0, column 0 holds NaN'),
      );
    });
  });

  describe('getTileIdAt()', () => {
    test('answers with 0 on a pattern that has no columns', () => {
      expect(new RepeatingTilesProvider().getTileIdAt(0, 0)).toBe(0);
      expect(new RepeatingTilesProvider().getTileIdAt(3, 7)).toBe(0);
      expect(new RepeatingTilesProvider().getTileIdAt(-3, -7)).toBe(0);

      expect(new RepeatingTilesProvider(undefined, 'horizontal').getTileIdAt(0, 0)).toBe(0);
      expect(new RepeatingTilesProvider(undefined, 'horizontal').getTileIdAt(3, 7)).toBe(0);
      expect(new RepeatingTilesProvider(undefined, 'horizontal').getTileIdAt(-3, -7)).toBe(0);

      expect(new RepeatingTilesProvider(undefined, 'vertical').getTileIdAt(0, 0)).toBe(0);
    });
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
    describe('agrees with getTileIdAt()', () => {
      const patterns = [
        [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
        ],
        [[1, 2, 3]],
        [[1], [2], [3]],
        [[9]],
      ];

      test.each(['vertical', 'horizontal', 'none'] as const)('%s', (limitToAxis) => {
        // every cell of every rectangle is held against the single-cell lookup; what differs, or
        // throws, is collected, so a failure names the rectangle instead of drowning in expects
        const mismatches: string[] = [];
        for (const pattern of patterns) {
          const provider = new RepeatingTilesProvider(pattern, limitToAxis);
          for (let left = -6; left <= 6; left++) {
            for (let top = -4; top <= 4; top++) {
              for (let width = 1; width <= 9; width++) {
                for (let height = 1; height <= 4; height++) {
                  const where = `${JSON.stringify(pattern)}, ${left}, ${top}, ${width}, ${height}`;
                  let ids: Uint32Array;
                  try {
                    ids = provider.getTileIdsWithin(left, top, width, height);
                  } catch (error) {
                    mismatches.push(`${where}: ${(error as Error).message}`);
                    continue;
                  }
                  cells: for (let j = 0; j < height; j++) {
                    for (let i = 0; i < width; i++) {
                      const expected = provider.getTileIdAt(left + i, top + j);
                      if (ids[j * width + i] !== expected) {
                        mismatches.push(`${where}: cell (${i}, ${j}) is ${ids[j * width + i]} instead of ${expected}`);
                        break cells;
                      }
                    }
                  }
                }
              }
            }
          }
        }
        expect(mismatches).toEqual([]);
      });
    });
    describe('a target of another length than width × height', () => {
      const providers = {
        vertical: () =>
          new RepeatingTilesProvider(
            [
              [1, 2],
              [3, 4],
            ],
            'vertical',
          ),
        horizontal: () =>
          new RepeatingTilesProvider(
            [
              [1, 2],
              [3, 4],
            ],
            'horizontal',
          ),
        none: () =>
          new RepeatingTilesProvider(
            [
              [1, 2],
              [3, 4],
            ],
            'none',
          ),
        'a pattern without cells': () => new RepeatingTilesProvider(),
      };

      test.each(Object.keys(providers) as (keyof typeof providers)[])(
        '%s: leaves the cells past width × height of a longer target as they are',
        (name) => {
          const provider = providers[name]();
          // one rectangle that meets the pattern, one that lies wholly outside of it (for 'vertical'
          // left of 10 is outside, for 'horizontal' top of 10)
          for (const [left, top] of [
            [-1, -1],
            [10, 10],
          ] as const) {
            const width = 3;
            const height = 2;
            const target = new Uint32Array(width * height + 3).fill(666);

            provider.getTileIdsWithin(left, top, width, height, target);

            const expected = Array.from({length: width * height}, (_, i) =>
              provider.getTileIdAt(left + (i % width), top + Math.floor(i / width)),
            );
            expect(Array.from(target)).toEqual([...expected, 666, 666, 666]);
          }
        },
      );

      test.each(Object.keys(providers) as (keyof typeof providers)[])(
        '%s: refuses a target shorter than width × height',
        (name) => {
          const read = () => providers[name]().getTileIdsWithin(0, 0, 3, 2, new Uint32Array(5));

          expect(read).toThrow(RangeError);
          expect(read).toThrow('RepeatingTilesProvider#getTileIdsWithin(): a target for 3x2 tile ids needs 6 cells, got 5');
        },
      );

      const names = Object.keys(providers) as (keyof typeof providers)[];
      const coordinateCases = names.flatMap((name) =>
        (['left', 'top'] as const).flatMap((arg) => [0.5, NaN, Infinity].map((value) => [name, arg, value] as const)),
      );
      const countCases = names.flatMap((name) =>
        (['width', 'height'] as const).flatMap((arg) => [-1, 1.5, NaN].map((value) => [name, arg, value] as const)),
      );
      const argsWith = (arg: 'left' | 'top' | 'width' | 'height', value: number): [number, number, number, number] => {
        const args: Record<typeof arg, number> = {left: 0, top: 0, width: 2, height: 2};
        args[arg] = value;
        return [args.left, args.top, args.width, args.height];
      };

      test.each(coordinateCases)('%s: refuses a %s of %p and leaves the target alone', (name, arg, value) => {
        const target = new Uint32Array(8).fill(666);
        const read = () => providers[name]().getTileIdsWithin(...argsWith(arg, value), target);

        expect(read).toThrow(RangeError);
        expect(read).toThrow(`RepeatingTilesProvider#getTileIdsWithin(): ${arg} must be a whole number, got ${value}`);
        expect(Array.from(target), 'target').toEqual(new Array(8).fill(666));
      });

      test.each(countCases)('%s: refuses a %s of %p and leaves the target alone', (name, arg, value) => {
        const target = new Uint32Array(8).fill(666);
        const read = () => providers[name]().getTileIdsWithin(...argsWith(arg, value), target);

        expect(read).toThrow(RangeError);
        expect(read).toThrow(
          `RepeatingTilesProvider#getTileIdsWithin(): ${arg} must be a whole number of 0 or more, got ${value}`,
        );
        expect(Array.from(target), 'target').toEqual(new Array(8).fill(666));
      });

      test('names the coordinate and the count it refuses', () => {
        const provider = providers.none();

        expect(() => provider.getTileIdsWithin(0.5, 0, 1, 1)).toThrow(
          'RepeatingTilesProvider#getTileIdsWithin(): left must be a whole number, got 0.5',
        );
        expect(() => provider.getTileIdsWithin(0, 0, -1, 1)).toThrow(
          'RepeatingTilesProvider#getTileIdsWithin(): width must be a whole number of 0 or more, got -1',
        );
      });

      test.each(
        names.flatMap((name) =>
          (['col', 'row'] as const).flatMap((arg) => [0.5, NaN].map((value) => [name, arg, value] as const)),
        ),
      )('%s: getTileIdAt() refuses a %s of %p', (name, arg, value) => {
        const read = () => (arg === 'col' ? providers[name]().getTileIdAt(value, 0) : providers[name]().getTileIdAt(0, value));

        expect(read).toThrow(RangeError);
        expect(read).toThrow(`RepeatingTilesProvider#getTileIdAt(): ${arg} must be a whole number, got ${value}`);
      });

      test('getTileIdAt() names the coordinate it refuses', () => {
        expect(() => providers.none().getTileIdAt(NaN, 0)).toThrow(
          'RepeatingTilesProvider#getTileIdAt(): col must be a whole number, got NaN',
        );
      });
    });
    describe('a limitToAxis outside the type', () => {
      const pattern = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ];

      // assigned after construction: the default parameter of the constructor would turn
      // `undefined` into 'none'
      const makeProvider = (value: unknown) => {
        const provider = new RepeatingTilesProvider(pattern);
        provider.limitToAxis = value as LimitToAxisType;
        return provider;
      };

      test.each(['diagonal', '', undefined, null])('%j repeats the pattern along both axes, as getTileIdAt() does', (value) => {
        const provider = makeProvider(value);
        const reference = new RepeatingTilesProvider(pattern, 'none');

        const ids = provider.getTileIdsWithin(-3, -1, 9, 4);

        expect(Array.from(ids)).toEqual(Array.from(reference.getTileIdsWithin(-3, -1, 9, 4)));
        for (let j = 0; j < 4; j++) {
          for (let i = 0; i < 9; i++) {
            expect(ids[j * 9 + i], `cell (${i}, ${j})`).toBe(provider.getTileIdAt(-3 + i, -1 + j));
          }
        }
      });

      test('writes every cell of a target it is handed, whatever limitToAxis holds', () => {
        const provider = makeProvider('diagonal');
        const reference = new RepeatingTilesProvider(pattern, 'none');
        const target = new Uint32Array(36).fill(99);

        const ids = provider.getTileIdsWithin(-3, -1, 9, 4, target);

        expect(ids).toBe(target);
        expect(Array.from(ids)).toEqual(Array.from(reference.getTileIdsWithin(-3, -1, 9, 4)));
      });
    });
    describe('vertical', () => {
      test('right outside', () => {
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([[1],[2],[3]], 'vertical').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 0, 0,
          2, 0, 0,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([[1],[2],[3]], 'vertical').getTileIdsWithin(0, 2, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          3, 0, 0,
          1, 0, 0,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4], 'vertical').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          1, 2, 3,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4], 'vertical').getTileIdsWithin(-1, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 1, 2,
          0, 1, 2,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
      test('starts at the pattern column of a left edge inside the pattern', () => {
        const provider = new RepeatingTilesProvider([1, 2, 3, 4], 'vertical');
        expect(Array.from(provider.getTileIdsWithin(1, 0, 3, 1))).toEqual([2, 3, 4]);
        expect(Array.from(provider.getTileIdsWithin(2, 0, 2, 1))).toEqual([3, 4]);
      });
      test('fills with 0 past the right edge of the pattern for a left edge inside it', () => {
        const provider = new RepeatingTilesProvider(
          [
            [1, 2, 3, 4],
            [5, 6, 7, 8],
          ],
          'vertical',
        );
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(Array.from(provider.getTileIdsWithin(1, 0, 3, 2))).toEqual([
          2, 3, 4,
          6, 7, 8,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(Array.from(provider.getTileIdsWithin(2, 1, 4, 2))).toEqual([
          7, 8, 0, 0,
          3, 4, 0, 0,
        ]);
      });
    });
    describe('horizontal', () => {
      test('repeats a pattern that does not end on the target edge', () => {
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3], 'horizontal').getTileIdsWithin(1, 0, 10, 1, new Uint32Array(10).fill(666)),
          ),
        ).toEqual([2, 3, 1, 2, 3, 1, 2, 3, 1, 2]);
      });
      test('top outside', () => {
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider(1, 'horizontal').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 1, 1,
          0, 0, 0,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2], 'horizontal').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 1,
          0, 0, 0,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4], 'horizontal').getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          0, 0, 0,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4], 'horizontal').getTileIdsWithin(2, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          0, 0, 0,
          3, 4, 1,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
      test('repeats a pattern that does not end on the target edge', () => {
        expect(
          Array.from(new RepeatingTilesProvider([1, 2, 3]).getTileIdsWithin(1, 0, 10, 1, new Uint32Array(10).fill(666))),
        ).toEqual([2, 3, 1, 2, 3, 1, 2, 3, 1, 2]);
      });
      test('repeats every row of a multi-row pattern the same way', () => {
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([
              [1, 2, 3],
              [4, 5, 6],
            ]).getTileIdsWithin(1, 0, 8, 2, new Uint32Array(16).fill(666)),
          ),
        ).toEqual([
          2, 3, 1, 2, 3, 1, 2, 3,
          5, 6, 4, 5, 6, 4, 5, 6,
        ]);
      });
      test('1x1 pattern', () => {
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider(1).getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 1, 1,
          1, 1, 1,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2]).getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 1,
          1, 2, 1,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4]).getTileIdsWithin(0, 0, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          1, 2, 3,
          1, 2, 3,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
        expect(
          Array.from(
            new RepeatingTilesProvider([1, 2, 3, 4]).getTileIdsWithin(2, -1, 3, 2, new Uint32Array(6).fill(666)),
          ),
        ).toEqual([
          3, 4, 1,
          3, 4, 1,
        ]);
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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
        // biome-ignore format: the line breaks lay the numbers out row by row
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

  describe('the tile pattern', () => {
    test('a row the caller shortens after the assignment leaves the pattern as it was', () => {
      const rows = [
        [1, 2],
        [3, 4],
      ];
      const provider = new RepeatingTilesProvider();
      provider.tileIds = rows;

      rows[1]!.length = 1;
      rows.push([9, 9]);

      expect(provider.getTileIdAt(1, 1)).toBe(4);
      expect([...provider.getTileIdsWithin(0, 0, 2, 2)]).toEqual([1, 2, 3, 4]);
    });

    test('the pattern it hands out is frozen', () => {
      const provider = new RepeatingTilesProvider([
        [1, 2],
        [3, 4],
      ]);

      expect(Object.isFrozen(provider.tileIds)).toBe(true);
      expect(Object.isFrozen(provider.tileIds[0])).toBe(true);
      // a module runs in strict mode, where a write to a frozen array throws
      expect(() => {
        (provider.tileIds[0] as number[])[0] = 5;
      }).toThrow(TypeError);
      expect(provider.getTileIdAt(0, 0)).toBe(1);

      // the guard keeps the type error from running
      if (provider.tileIds.length < 0) {
        // @ts-expect-error a new pattern is assigned, not written into
        provider.tileIds[0]![0] = 5;
      }
    });
  });
});
