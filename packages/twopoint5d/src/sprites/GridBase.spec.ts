import {describe, expect, test} from 'vitest';

import {VertexObjectPool} from '../vertex-objects/VertexObjectPool.js';
import {defineSprite} from './defineSprite.js';
import {FeatureSpritesGeometry} from './FeatureSprites/FeatureSpritesGeometry.js';
import {FlatPlacement} from './features/FlatPlacement.js';
import {InstancePosition} from './features/InstancePosition.js';
import {type GridBaseVO, gridBase} from './GridBase.js';
import {QuadBase} from './SpriteBase.js';

type Vertex = {x: number; y: number; z: number; u: number; v: number};

// the vertices of a base vertex object made from `args`, as numbers rounded to float32
const verticesOf = (columns: number, rows: number, ...args: Parameters<GridBaseVO['make']>): Vertex[] => {
  const base = gridBase({columns, rows});
  const pool = new VertexObjectPool<GridBaseVO>(base.description, 1);
  const grid = pool.createVO()!;
  grid.make(...args);
  const position = grid.getPosition() as number[];
  const uv = grid.getUv() as number[];
  pool.dispose();
  return Array.from({length: (columns + 1) * (rows + 1)}, (_, k) => ({
    x: position[k * 3]!,
    y: position[k * 3 + 1]!,
    z: position[k * 3 + 2]!,
    u: uv[k * 2]!,
    v: uv[k * 2 + 1]!,
  }));
};

const f32 = (value: number) => Math.fround(value);

// twice the signed area of a triangle: positive counter-clockwise, as three counts the front
const area = (a: Vertex, b: Vertex, c: Vertex) => (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);

describe('gridBase()', () => {
  test('answers one frozen base per option set', () => {
    const grid = gridBase({columns: 3, rows: 3});

    expect(gridBase({columns: 3, rows: 3})).toBe(grid);
    expect(gridBase({columns: 3, rows: 2})).not.toBe(grid);
    expect(Object.isFrozen(grid)).toBe(true);
    expect([grid.name, grid.columns, grid.rows]).toEqual(['grid 3x3', 3, 3]);
    expect(grid.defaultArgs).toEqual([0.5, 0.5]);
  });

  test('answers a base frozen all the way down, its description and the prototype of its base vertex included', () => {
    const grid = gridBase({columns: 3, rows: 3});
    const {description} = grid;

    expect(Object.isFrozen(description)).toBe(true);
    expect(Object.isFrozen(description.attributes)).toBe(true);
    expect(Object.isFrozen(description.attributes['position'])).toBe(true);
    expect(Object.isFrozen(description.indices)).toBe(true);
    expect(Object.isFrozen(description.basePrototype)).toBe(true);
    expect(Object.isFrozen(grid.defaultArgs)).toBe(true);
    expect(() => {
      description.indices!.push(0);
    }).toThrow(TypeError);
  });

  test('is (columns + 1) × (rows + 1) vertices with a position of 3 and a uv of 2 values, no property per vertex', () => {
    const {description} = gridBase({columns: 4, rows: 2});

    expect(description.vertexCount).toBe(15);
    expect(description.attributes['position']).toEqual({size: 3});
    expect(description.attributes['uv']).toEqual({size: 2});
    expect(description.indices).toHaveLength(4 * 2 * 6);
  });

  test('lays out a 1 × 1 grid as the corners of the quad, row by row from the top', () => {
    expect(verticesOf(1, 1, 0.5, 0.5)).toEqual([
      {x: -0.5, y: 0.5, z: 0, u: 0, v: 0},
      {x: 0.5, y: 0.5, z: 0, u: 1, v: 0},
      {x: -0.5, y: -0.5, z: 0, u: 0, v: 1},
      {x: 0.5, y: -0.5, z: 0, u: 1, v: 1},
    ]);
    // the quad's triangles A C B and A D C, with A = BL, B = TL, C = TR, D = BR
    expect(gridBase({columns: 1, rows: 1}).description.indices).toEqual([2, 1, 0, 2, 3, 1]);
  });

  test('lays out the grid lines evenly, from the half measures and the offset it is given', () => {
    const vertices = verticesOf(4, 2, 2, 3, 1, 1);

    for (let j = 0; j <= 2; j++) {
      for (let i = 0; i <= 4; i++) {
        const vertex = vertices[j * 5 + i]!;
        expect(vertex).toEqual({x: f32(-2 + 1 + i), y: f32(3 + 1 - 3 * j), z: 0, u: f32(i / 4), v: f32(j / 2)});
      }
    }
  });

  test('makes the unit grid when called without arguments', () => {
    const vertices = verticesOf(2, 2);

    expect([vertices[0]!.x, vertices[0]!.y, vertices[8]!.x, vertices[8]!.y]).toEqual([-0.5, 0.5, 0.5, -0.5]);
  });

  test.each([
    [1, 1],
    [3, 3],
    [4, 2],
  ])('turns every triangle of a %i × %i grid to the front, two per cell, covering it once', (columns, rows) => {
    const vertices = verticesOf(columns, rows);
    const indices = gridBase({columns, rows}).description.indices!;
    let covered = 0;
    for (let t = 0; t < indices.length; t += 3) {
      const twice = area(vertices[indices[t]!]!, vertices[indices[t + 1]!]!, vertices[indices[t + 2]!]!);
      expect(twice).toBeGreaterThan(0);
      covered += twice / 2;
    }
    expect(covered).toBeCloseTo(1, 6);
  });

  test('keeps the grid line of every vertex exact in its uv', () => {
    const vertices = verticesOf(1024, 1);

    vertices.slice(0, 1025).forEach((vertex, i) => {
      expect(Math.round(vertex.u * 1024)).toBe(i);
    });
  });

  test.each([
    [{columns: 2.5, rows: 3}, 'gridBase: columns is 2.5 — columns and rows are whole numbers from 1 to 1024'],
    [{columns: 3, rows: 0}, 'gridBase: rows is 0 — columns and rows are whole numbers from 1 to 1024'],
    [{columns: 1025, rows: 1}, 'gridBase: columns is 1025 — columns and rows are whole numbers from 1 to 1024'],
    [{columns: '3', rows: 3}, 'gridBase: columns is "3" — columns and rows are whole numbers from 1 to 1024'],
    [{rows: 3}, 'gridBase: columns is undefined — columns and rows are whole numbers from 1 to 1024'],
    [undefined, 'gridBase: takes {columns, rows} — gridBase({columns: 3, rows: 3})'],
    [{columns: 1000, rows: 1000}, 'gridBase: a grid of 1000 × 1000 is 1000000 cells — a grid holds at most 4096'],
    [{columns: 1024, rows: 5}, 'gridBase: a grid of 1024 × 5 is 5120 cells — a grid holds at most 4096'],
  ])('refuses %j', (options, message) => {
    expect(() => gridBase(options as never)).toThrow(new TypeError(message));
  });

  test('takes a grid of 4096 cells: 64 × 64 and 1024 × 4', () => {
    expect(gridBase({columns: 64, rows: 64}).description.vertexCount).toBe(65 * 65);
    expect(gridBase({columns: 1024, rows: 4}).description.vertexCount).toBe(1025 * 5);
  });

  test('builds a sprite geometry that draws two triangles per cell for every sprite', () => {
    const kind = defineSprite({base: gridBase({columns: 3, rows: 2}), features: [InstancePosition, FlatPlacement]});
    const geometry = new FeatureSpritesGeometry(kind, {capacity: 4, baseArgs: [1, 1]});
    const vertices = geometry.basePool.getVO(0) as unknown as GridBaseVO;

    expect(geometry.index!.count).toBe(3 * 2 * 6);
    expect(Array.from(vertices.getPosition() as ArrayLike<number>).slice(0, 3)).toEqual([-1, 1, 0]);
    expect(kind.base).not.toBe(QuadBase);
    geometry.dispose();
  });
});
