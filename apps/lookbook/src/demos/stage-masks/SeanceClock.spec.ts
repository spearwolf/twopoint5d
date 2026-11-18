import {describe, expect, it} from 'vitest';
import type {HeadJson, RoomJson} from './chapelAssets.js';
import {SeanceClock} from './SeanceClock.js';

/** `marks` without the mark `name` */
const without = (marks: Record<string, [number, number]>, name: string): Record<string, [number, number]> =>
  Object.fromEntries(Object.entries(marks).filter(([key]) => key !== name));

const head = (name: string, x: number): HeadJson => ({name, x, y: 0, r: 10, face: name, yaw: 0, pitch: 0});

const room = (change: (layout: RoomJson) => void = () => {}): RoomJson => {
  const layout: RoomJson = {
    extent: 100,
    board: {
      x: 0,
      y: 0,
      w: 80,
      h: 40,
      marks: {I: [-30, 10], S: [-20, 10], E: [-10, 10], Y: [0, 10], O: [10, 10], U: [20, 10], 'GOOD BYE': [0, -10]},
    },
    lens: {x: 2, y: 3},
    candles: [
      {x: -40, y: 0, size: 1},
      {x: 0, y: 30, size: 1},
      {x: 40, y: 0, size: 1},
    ],
    stands: [
      {x: -60, y: -20, size: 2},
      {x: 60, y: -20, size: 2},
    ],
    heads: [head('a', -30), head('b', -10), head('c', 10), head('d', 30)],
    lights: [],
  };
  change(layout);
  return layout;
};

describe('SeanceClock', () => {
  it('refuses a board without a mark the planchette spells, as it is built', () => {
    expect(() => new SeanceClock(room((layout) => (layout.board.marks = without(layout.board.marks, 'S'))))).toThrow(
      new Error('new SeanceClock(): the board of room.json has no mark "S"'),
    );
    expect(() => new SeanceClock(room((layout) => (layout.board.marks = without(layout.board.marks, 'GOOD BYE'))))).toThrow(
      new Error('new SeanceClock(): the board of room.json has no mark "GOOD BYE"'),
    );
  });

  it('refuses another count of heads than the séance turns, as it is built', () => {
    expect(() => new SeanceClock(room((layout) => layout.heads.pop()))).toThrow(
      new Error('new SeanceClock(): room.json has 3 heads, and the séance turns 4'),
    );
  });

  it('refuses a room without candles, as it is built', () => {
    expect(() => new SeanceClock(room((layout) => (layout.candles = [])))).toThrow(
      new Error('new SeanceClock(): room.json has no candles, and the heads are lit from their middle'),
    );
  });

  it('holds one flicker per candle and stand of the layout', () => {
    expect(new SeanceClock(room()).flicker.length).toBe(5);
  });

  it('keeps every value it hands out finite over a whole round', () => {
    const clock = new SeanceClock(room());
    expect(clock.turn.length).toBe(4);
    for (let t = 0; t < 46; t += 0.1) {
      clock.update(0.1);
      for (const flicker of clock.flicker) expect(Number.isFinite(flicker.value)).toBe(true);
      for (const turn of clock.turn) expect(Number.isFinite(turn)).toBe(true);
      expect(Number.isFinite(clock.planchetteX)).toBe(true);
      expect(Number.isFinite(clock.planchetteY)).toBe(true);
    }
  });
});
