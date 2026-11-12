import {describe, expect, test, vi} from 'vitest';

import {FramePacer, type FramePacerSource, type Motion} from './FramePacer.js';
import type {DisplayEventProps} from './types.js';

type Listener = (frame: DisplayEventProps) => unknown;

/**
 * A source of frames as a `Display` is one: it keeps the listeners it is handed and sends them
 * what the test emits. `only` leaves out the optional subscriptions a host of one's own lacks.
 */
const makeSource = ({only}: {only?: 'onRenderFrame'} = {}) => {
  const listeners = {frame: new Set<Listener>(), resize: new Set<Listener>(), restart: new Set<Listener>()};
  const subscribe = (set: Set<Listener>) => (listener: Listener) => {
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  };
  const emit = (set: Set<Listener>, frame: DisplayEventProps) => {
    for (const listener of Array.from(set)) listener(frame);
  };
  const source: FramePacerSource =
    only === 'onRenderFrame'
      ? {onRenderFrame: subscribe(listeners.frame)}
      : {
          onRenderFrame: subscribe(listeners.frame),
          onResize: subscribe(listeners.resize),
          onRestart: subscribe(listeners.restart),
        };
  return {
    source,
    listeners,
    /** Sends a frame to the steps, as the display does once per frame. */
    emitFrame: (frame: DisplayEventProps = FRAME) => emit(listeners.frame, frame),
    emitResize: (frame: DisplayEventProps = FRAME) => emit(listeners.resize, frame),
    emitRestart: (frame: DisplayEventProps = FRAME) => emit(listeners.restart, frame),
  };
};

/** The props of a frame `ms` milliseconds after the one before; the pacer reads the two deltas alone. */
const frameAfter = (ms: number): DisplayEventProps => ({rawDeltaTime: ms / 1000, deltaTime: ms / 1000}) as DisplayEventProps;

/** A frame of a screen at 60 Hz. */
const FRAME = frameAfter(1000 / 60);

const makePacer = (options?: ConstructorParameters<typeof FramePacer>[1]) => {
  const stage = makeSource();
  return {...stage, pacer: new FramePacer(stage.source, options)};
};

/** A pacer whose first frame is drawn: nothing is pending. */
const makeSettledPacer = (options?: ConstructorParameters<typeof FramePacer>[1]) => {
  const made = makePacer(options);
  expect(made.pacer.shouldDraw(FRAME), 'the first frame').toBe(true);
  return made;
};

describe('FramePacer', () => {
  describe('reports', () => {
    test('the first frame draws', () => {
      const {pacer} = makePacer();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });

    test('a frame without a report draws nothing', () => {
      const {pacer} = makeSettledPacer();

      expect(pacer.shouldDraw(FRAME)).toBe(false);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test('invalidate() draws the next frame, once', () => {
      const {pacer} = makeSettledPacer();

      pacer.invalidate();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test('report(true) draws the next frame, once', () => {
      const {pacer} = makeSettledPacer();

      pacer.report(true);

      expect(pacer.shouldDraw(FRAME)).toBe(true);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test.each([[false], [undefined]] as const)('report(%s) draws nothing', (motion) => {
      const {pacer} = makeSettledPacer();

      pacer.report(motion);

      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test('an answer the pacer does not know draws rather than freezes', () => {
      const {pacer} = makeSettledPacer();

      pacer.report('moving' as unknown as Motion);

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });

    test('several reports before a frame draw it once', () => {
      const {pacer} = makeSettledPacer();

      pacer.report(true);
      pacer.report('steady');
      pacer.invalidate();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
      expect(pacer.shouldDraw(FRAME), 'the draw took every report, the steady one included').toBe(false);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });
  });

  describe('busy', () => {
    test('forces the draw of a frame without a report', () => {
      const {pacer} = makeSettledPacer();

      expect(pacer.shouldDraw(FRAME, true)).toBe(true);
      expect(pacer.shouldDraw(FRAME, true)).toBe(true);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test('a draw it forces takes the pending reports', () => {
      const {pacer} = makeSettledPacer();
      pacer.invalidate();

      expect(pacer.shouldDraw(FRAME, true)).toBe(true);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });
  });

  describe('counters', () => {
    test('frames counts the frames asked about, draws those that drew', () => {
      const {pacer} = makePacer();
      expect([pacer.frames, pacer.draws]).toEqual([0, 0]);

      pacer.shouldDraw(FRAME); // the first frame
      pacer.shouldDraw(FRAME);
      pacer.shouldDraw(FRAME);
      pacer.invalidate();
      pacer.shouldDraw(FRAME);
      pacer.shouldDraw(FRAME, true);

      expect([pacer.frames, pacer.draws]).toEqual([5, 3]);
    });
  });

  describe('steadyFps', () => {
    test('is 30 by default', () => {
      const {pacer} = makePacer();

      expect(FramePacer.DefaultSteadyFps).toBe(30);
      expect(pacer.steadyFps).toBe(30);
    });

    test('is the option', () => {
      const {pacer} = makePacer({steadyFps: 15});

      expect(pacer.steadyFps).toBe(15);
    });
  });

  describe('frame steps', () => {
    test('a step runs once per frame, with the props of the frame', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const step = vi.fn();
      pacer.onFrame(step);
      const frame = frameAfter(10);

      emitFrame(frame);
      emitFrame(FRAME);

      expect(step.mock.calls).toEqual([[frame], [FRAME]]);
    });

    test.each([
      [true, true],
      [false, false],
      [undefined, false],
    ] as const)('a step that answers %s: the next frame draws — %s', (motion, draws) => {
      const {pacer, emitFrame} = makeSettledPacer();
      pacer.onFrame(() => motion);

      emitFrame();

      expect(pacer.shouldDraw(FRAME)).toBe(draws);
    });

    test('the answers of a frame add up: one step that moved draws the frame', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      pacer.onFrame(() => false);
      pacer.onFrame(() => true);
      pacer.onFrame(() => undefined);

      emitFrame();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });

    test('steps run in the order they were registered', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const order: string[] = [];
      pacer.onFrame(() => void order.push('camera'));
      pacer.onFrame(() => void order.push('particles'));
      pacer.onFrame(() => void order.push('layers'));

      emitFrame();

      expect(order).toEqual(['camera', 'particles', 'layers']);
    });

    test('the unsubscribe takes the step off', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const step = vi.fn(() => true);
      const unsubscribe = pacer.onFrame(step);

      unsubscribe();
      unsubscribe(); // a second call changes nothing
      emitFrame();

      expect(step).not.toHaveBeenCalled();
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test('one function registered twice runs twice, and each registration ends by itself', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const step = vi.fn();
      const first = pacer.onFrame(step);
      pacer.onFrame(step);

      emitFrame();
      expect(step).toHaveBeenCalledTimes(2);

      first();
      first(); // must not take the second registration with it
      emitFrame();
      expect(step).toHaveBeenCalledTimes(3);
    });

    test('a step registered while the steps run first runs in the next frame', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const late = vi.fn();
      let registered = false;
      pacer.onFrame(() => {
        if (!registered) {
          registered = true;
          pacer.onFrame(late);
        }
      });

      emitFrame();
      expect(late).not.toHaveBeenCalled();

      emitFrame();
      expect(late).toHaveBeenCalledTimes(1);
    });

    test('a step that unsubscribes itself while the steps run leaves the ones behind it running', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const order: string[] = [];
      const unsubscribe = pacer.onFrame(() => {
        order.push('once');
        unsubscribe();
      });
      pacer.onFrame(() => void order.push('behind'));

      emitFrame();
      emitFrame();

      expect(order).toEqual(['once', 'behind', 'behind']);
    });

    test('a step unsubscribed by one before it does not run any more, in this frame included', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const order: string[] = [];
      let unsubscribeNeighbour = () => {};
      pacer.onFrame(() => {
        order.push('first');
        unsubscribeNeighbour();
      });
      unsubscribeNeighbour = pacer.onFrame(() => void order.push('neighbour'));
      pacer.onFrame(() => void order.push('last'));

      emitFrame();
      emitFrame();

      expect(order).toEqual(['first', 'last', 'first', 'last']);
    });

    test('a step registered and taken off again within one run never runs', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const shortLived = vi.fn();
      const behind = vi.fn();
      let done = false;
      pacer.onFrame(() => {
        if (done) return;
        done = true;
        pacer.onFrame(shortLived)();
      });
      pacer.onFrame(behind);

      emitFrame();
      emitFrame();

      expect(shortLived).not.toHaveBeenCalled();
      expect(behind).toHaveBeenCalledTimes(2);
    });

    test('a step that unsubscribes one before it skips none behind it', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const order: string[] = [];
      const unsubscribeFirst = pacer.onFrame(() => void order.push('first'));
      pacer.onFrame(() => {
        order.push('second');
        unsubscribeFirst();
      });
      pacer.onFrame(() => void order.push('third'));

      emitFrame();
      emitFrame();

      expect(order).toEqual(['first', 'second', 'third', 'second', 'third']);
    });
  });

  describe("'steady'", () => {
    /**
     * Runs `count` frames of a screen at `hz` with `'steady'` reported before each, and answers how
     * many of them drew. `jitter` makes every other frame that share late and the ones between as
     * early.
     */
    const steadyDraws = (pacer: FramePacer, hz: number, count: number, jitter = 0): number => {
      const before = pacer.draws;
      for (let i = 0; i < count; i++) {
        pacer.report('steady');
        pacer.shouldDraw(frameAfter((1000 / hz) * (1 + (i % 2 === 0 ? jitter : -jitter))));
      }
      return pacer.draws - before;
    };

    test.each([
      [60, 2],
      [75, 2],
      [90, 3],
      [100, 3],
      [120, 4],
      [144, 5],
      [165, 5],
      [240, 8],
    ])('a screen at %i Hz draws every %i. frame', (hz, stride) => {
      const {pacer} = makePacer();
      steadyDraws(pacer, hz, 10);

      expect(steadyDraws(pacer, hz, stride * 100)).toBe(100);
    });

    test('a step that answers steady draws at the stride, not the next frame', () => {
      const {pacer, emitFrame} = makeSettledPacer(); // 60 Hz: every 2. frame
      pacer.onFrame(() => 'steady');

      const drawn: boolean[] = [];
      for (let i = 0; i < 6; i++) {
        emitFrame();
        drawn.push(pacer.shouldDraw(FRAME));
      }

      expect(drawn).toEqual([false, true, false, true, false, true]);
    });

    test('165 Hz keeps its stride of 5 under the jitter of single frames: the stride goes by the average of the gaps', () => {
      const {pacer} = makePacer();
      steadyDraws(pacer, 165, 10);

      expect(steadyDraws(pacer, 165, 1000, 0.2)).toBe(200);
    });

    test('144 Hz, a hair from the edge between two strides, keeps 5 under jitter', () => {
      const {pacer} = makePacer();
      steadyDraws(pacer, 144, 10);

      // a frame a quarter late moves the average of the gaps by 2.5 %, and the ratio from 4.8
      // across the edge at 4.75, below which a measurement picks 4 — for that one frame
      expect(steadyDraws(pacer, 144, 1000, 0.25)).toBe(200);
    });

    test('a slow start does not leave its mark: 144 Hz ends at 5 after first frames of 100 ms', () => {
      const {pacer} = makePacer();
      // the frames in which the shaders compile
      for (let i = 0; i < 5; i++) pacer.shouldDraw(frameAfter(100));

      steadyDraws(pacer, 144, 300);

      expect(steadyDraws(pacer, 144, 1000)).toBe(200);
    });

    test('a few late frames in a row do not move the stride', () => {
      const {pacer} = makePacer();
      steadyDraws(pacer, 60, 10); // every 2. frame

      // three dropped frames take the average of the gaps to where a measurement picks 1
      const drawn: boolean[] = [];
      for (let i = 0; i < 3; i++) {
        pacer.report('steady');
        pacer.shouldDraw(frameAfter(2000 / 60));
      }
      for (let i = 0; i < 8; i++) {
        pacer.report('steady');
        drawn.push(pacer.shouldDraw(FRAME));
      }

      expect(drawn.filter(Boolean).length, 'still every 2. frame').toBe(4);
    });

    test('a screen that changes its rate moves the stride', () => {
      const {pacer} = makePacer();
      steadyDraws(pacer, 60, 10);
      expect(steadyDraws(pacer, 60, 200)).toBe(100);

      steadyDraws(pacer, 120, 200);

      expect(steadyDraws(pacer, 120, 400)).toBe(100);
    });

    test('steadyFps moves the stride', () => {
      const {pacer} = makePacer({steadyFps: 15});
      steadyDraws(pacer, 60, 10);

      expect(steadyDraws(pacer, 60, 400)).toBe(100);
    });

    test.each([
      ['30 frames per second, as under maxFps: 30', 30],
      ['fewer frames per second than steadyFps', 20],
    ])('at %s every frame draws', (_what, hz) => {
      const {pacer} = makePacer();
      steadyDraws(pacer, hz, 10);

      expect(steadyDraws(pacer, hz, 100)).toBe(100);
    });

    test.each([
      ['0 ms — a frame rendered during a pause', 0],
      ['250 ms — a hidden tab', 250],
      ['minutes', 180_000],
    ])('a gap of %s measures nothing', (_what, ms) => {
      const {pacer} = makePacer();
      steadyDraws(pacer, 60, 10);

      for (let i = 0; i < 50; i++) pacer.shouldDraw(frameAfter(ms));

      expect(steadyDraws(pacer, 60, 200)).toBe(100);
    });

    test('a gap just under 250 ms measures: frames that slow draw every one', () => {
      const {pacer} = makePacer();
      steadyDraws(pacer, 60, 10);

      for (let i = 0; i < 60; i++) pacer.shouldDraw(frameAfter(249));

      expect(steadyDraws(pacer, 1000 / 249, 10)).toBe(10);
    });

    test('until a gap is measured, every frame draws', () => {
      const {pacer} = makePacer();
      const drawn: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        pacer.report('steady');
        drawn.push(pacer.shouldDraw(frameAfter(0)));
      }

      expect(drawn).toEqual([true, true, true, true, true]);
    });

    test('props without rawDeltaTime measure by deltaTime', () => {
      const {pacer} = makePacer();
      const frame = {deltaTime: 1 / 60} as DisplayEventProps;
      const draw = () => {
        pacer.report('steady');
        return pacer.shouldDraw(frame);
      };
      for (let i = 0; i < 10; i++) draw();
      const before = pacer.draws;

      for (let i = 0; i < 200; i++) draw();

      expect(pacer.draws - before).toBe(100);
    });

    test('props without any delta measure nothing: every frame draws', () => {
      const {pacer} = makePacer();
      const frame = {} as DisplayEventProps;
      let draws = 0;
      for (let i = 0; i < 10; i++) {
        pacer.report('steady');
        if (pacer.shouldDraw(frame)) draws += 1;
      }

      expect(draws).toBe(10);
    });

    test('after a silence it draws the next frame', () => {
      const {pacer} = makeSettledPacer();
      for (let i = 0; i < 20; i++) expect(pacer.shouldDraw(FRAME)).toBe(false);

      pacer.report('steady');

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });

    test('reported once, it draws once, at its stride: the last state of an animation reaches the canvas', () => {
      const {pacer} = makeSettledPacer(); // 60 Hz: every 2. frame

      pacer.report('steady');

      expect(pacer.shouldDraw(FRAME)).toBe(false);
      expect(pacer.shouldDraw(FRAME)).toBe(true);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test('a report of true beside it draws the next frame', () => {
      const {pacer} = makeSettledPacer();

      pacer.report('steady');
      pacer.report(true);

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });
  });

  describe('a stage that is not live', () => {
    test('its steps run on, but their answers draw nothing', () => {
      const overlay = {name: 'overlay'};
      const room = {name: 'room'};
      const {pacer, emitFrame} = makeSettledPacer({live: (stage) => stage === overlay});
      const roomStep = vi.fn(() => true);
      pacer.onFrame(roomStep, room);

      emitFrame();

      expect(roomStep).toHaveBeenCalledTimes(1);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test('the answers of the steps of a live stage draw', () => {
      const overlay = {name: 'overlay'};
      const {pacer, emitFrame} = makeSettledPacer({live: (stage) => stage === overlay});
      pacer.onFrame(() => true, overlay);

      emitFrame();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });

    test('live is asked in every frame: a stage that comes back counts again', () => {
      const room = {name: 'room'};
      let frozen = true;
      const {pacer, emitFrame} = makeSettledPacer({live: () => !frozen});
      pacer.onFrame(() => true, room);

      emitFrame();
      expect(pacer.shouldDraw(FRAME)).toBe(false);

      frozen = false;
      emitFrame();
      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });

    test('live is asked only for a step that reports something', () => {
      const live = vi.fn(() => true);
      const room = {name: 'room'};
      const {pacer, emitFrame} = makeSettledPacer({live});
      let motion: Motion = false;
      pacer.onFrame(() => motion, room);

      emitFrame();
      expect(live).not.toHaveBeenCalled();

      motion = true;
      emitFrame();
      expect(live.mock.calls).toEqual([[room]]);
    });

    test('a step without a stage always counts', () => {
      const {pacer, emitFrame} = makeSettledPacer({live: () => false});
      pacer.onFrame(() => true);

      emitFrame();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });

    test('without the option every stage is live', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      pacer.onFrame(() => true, {name: 'room'});

      emitFrame();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });

    test('report() and invalidate() name no stage and always count', () => {
      const {pacer} = makeSettledPacer({live: () => false});

      pacer.report(true);
      expect(pacer.shouldDraw(FRAME)).toBe(true);

      pacer.invalidate();
      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });
  });

  describe('the type of a stage', () => {
    test('the live option names it, and onFrame() takes nothing else', () => {
      interface Layer {
        name: string;
        frozen: boolean;
      }
      const {source, emitFrame} = makeSource();
      const pacer = new FramePacer(source, {live: (layer: Layer) => !layer.frozen});
      const room: Layer = {name: 'room', frozen: true};
      pacer.shouldDraw(FRAME);
      pacer.onFrame(() => true, room);
      // @ts-expect-error a stage of this pacer is a Layer
      pacer.onFrame(() => true, {name: 'no layer'});

      room.frozen = false;
      emitFrame();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });
  });

  describe('a step that throws', () => {
    test('every step of the frame runs, and its error comes out unchanged', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const error = new Error('the camera lost its target');
      const behind = vi.fn();
      pacer.onFrame(() => {
        throw error;
      });
      pacer.onFrame(behind);

      expect(() => emitFrame()).toThrow(error);
      expect(behind).toHaveBeenCalledTimes(1);
    });

    test('two errors come out as an AggregateError', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const errors = [new Error('one'), new Error('two')];
      for (const error of errors) {
        pacer.onFrame(() => {
          throw error;
        });
      }

      let thrown: unknown;
      try {
        emitFrame();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).message).toBe('FramePacer: more than one frame step threw');
      expect((thrown as AggregateError).errors).toEqual(errors);
    });

    test('the frame draws: what the step wrote before it threw is unknown', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      pacer.onFrame(() => {
        throw new Error('half way through');
      });

      expect(() => emitFrame()).toThrow();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
    });

    test('the steps run again in the next frame', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      let fail = true;
      const step = vi.fn(() => {
        if (fail) throw new Error('once');
      });
      pacer.onFrame(step);

      expect(() => emitFrame()).toThrow();
      fail = false;
      emitFrame();

      expect(step).toHaveBeenCalledTimes(2);
    });
  });

  describe('the source', () => {
    test('the pacer subscribes once to the frames, the resize and the restart', () => {
      const {listeners} = makePacer();

      expect([listeners.frame.size, listeners.resize.size, listeners.restart.size]).toEqual([1, 1, 1]);
    });

    test('a resize draws the next frame: it cleared the canvas', () => {
      const {pacer, emitResize} = makeSettledPacer();

      emitResize();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test('a restart draws the next frame: the canvas may have lost its picture', () => {
      const {pacer, emitRestart} = makeSettledPacer();

      emitRestart();

      expect(pacer.shouldDraw(FRAME)).toBe(true);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });

    test('a source with onRenderFrame alone is taken, and runs the steps', () => {
      const {source, emitFrame} = makeSource({only: 'onRenderFrame'});
      const pacer = new FramePacer(source);
      const step = vi.fn();
      pacer.onFrame(step);

      emitFrame();

      expect(step).toHaveBeenCalledTimes(1);
    });

    test('a source that hands its size to a new listener right away, as a Display does, is taken', () => {
      const {source} = makeSource();
      const onResize = source.onResize!;
      source.onResize = (listener) => {
        listener(FRAME);
        return onResize(listener);
      };

      const pacer = new FramePacer(source);

      expect(pacer.shouldDraw(FRAME)).toBe(true);
      expect(pacer.shouldDraw(FRAME)).toBe(false);
    });
  });

  describe('refusals', () => {
    test.each([
      ['undefined', undefined, 'undefined'],
      ['null', null, 'null'],
      ['an object without onRenderFrame', {}, '{}'],
      ['an onRenderFrame that is no function', {onRenderFrame: 'frame'}, '{onRenderFrame: "frame"}'],
    ])('a source that is %s', (_what, source, shown) => {
      const build = () => new FramePacer(source as unknown as FramePacerSource);

      expect(build).toThrow(TypeError);
      expect(build).toThrow(`new FramePacer(): source must have an onRenderFrame() method, got ${shown}`);
    });

    test('a source that has been disposed, before the pacer subscribes to it', () => {
      const {source, listeners} = makeSource();
      const disposed = {...source, isDisposed: true};

      expect(() => new FramePacer(disposed)).toThrow('new FramePacer(): the source handed to the constructor has been disposed');
      expect(listeners.frame.size).toBe(0);
    });

    test.each([
      [0, '0'],
      [-30, '-30'],
      [Number.NaN, 'NaN'],
      [Number.POSITIVE_INFINITY, 'Infinity'],
      ['30', '"30"'],
    ])('a steadyFps of %s, before the pacer subscribes', (steadyFps, shown) => {
      const {source, listeners} = makeSource();
      const build = () => new FramePacer(source, {steadyFps: steadyFps as number});

      expect(build).toThrow(RangeError);
      expect(build).toThrow(`new FramePacer(): steadyFps must be a finite number above 0, got ${shown}`);
      expect(listeners.frame.size).toBe(0);
    });

    test('a live that is no function, before the pacer subscribes', () => {
      const {source, listeners} = makeSource();
      const build = () => new FramePacer(source, {live: true as unknown as () => boolean});

      expect(build).toThrow(TypeError);
      expect(build).toThrow('new FramePacer(): live must be a function, got true');
      expect(listeners.frame.size).toBe(0);
    });

    test('a step that is no function', () => {
      const {pacer} = makePacer();
      const register = () => pacer.onFrame('camera' as unknown as () => void);

      expect(register).toThrow(TypeError);
      expect(register).toThrow('FramePacer#onFrame(): step must be a function, got "camera"');
    });

    test('a source that throws while the pacer subscribes holds nothing of it', () => {
      const {source, listeners} = makeSource();
      const error = new Error('no restart on this host');
      source.onRestart = () => {
        throw error;
      };

      expect(() => new FramePacer(source)).toThrow(error);
      expect([listeners.frame.size, listeners.resize.size]).toEqual([0, 0]);
    });

    test('an unsubscribe that throws as the pacer gives back joins the error of the source', () => {
      const {source} = makeSource();
      const errors = [new Error('no restart on this host'), new Error('the frames are stuck')];
      source.onRestart = () => {
        throw errors[0];
      };
      source.onRenderFrame = () => () => {
        throw errors[1];
      };

      let thrown: unknown;
      try {
        new FramePacer(source);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).message).toBe(
        'new FramePacer(): the source threw as the pacer subscribed, and again as it gave its subscriptions back',
      );
      expect((thrown as AggregateError).errors).toEqual(errors);
    });
  });

  describe('dispose()', () => {
    test('gives every subscription back to the source', () => {
      const {pacer, listeners} = makePacer();

      pacer.dispose();

      expect([listeners.frame.size, listeners.resize.size, listeners.restart.size]).toEqual([0, 0, 0]);
    });

    test('isDisposed says so', () => {
      const {pacer} = makePacer();
      expect(pacer.isDisposed).toBe(false);

      pacer.dispose();

      expect(pacer.isDisposed).toBe(true);
    });

    test('a second call gives nothing back again', () => {
      const {source} = makeSource({only: 'onRenderFrame'});
      const unsubscribe = vi.fn();
      source.onRenderFrame = () => unsubscribe;
      const pacer = new FramePacer(source);

      pacer.dispose();
      pacer.dispose();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    test('an unsubscribe that throws holds up none of the others, and its error comes out afterwards', () => {
      const {source, listeners} = makeSource();
      const error = new Error('the frames are stuck');
      source.onRenderFrame = () => () => {
        throw error;
      };
      const pacer = new FramePacer(source);

      expect(() => pacer.dispose()).toThrow(error);

      expect(pacer.isDisposed).toBe(true);
      expect([listeners.resize.size, listeners.restart.size]).toEqual([0, 0]);
      expect(() => pacer.dispose(), 'a second call').not.toThrow();
    });

    test('two unsubscribes that throw come out as an AggregateError', () => {
      const {source} = makeSource();
      const errors = [new Error('the frames are stuck'), new Error('the resize is stuck')];
      source.onRenderFrame = () => () => {
        throw errors[0];
      };
      source.onResize = () => () => {
        throw errors[1];
      };
      const pacer = new FramePacer(source);

      let thrown: unknown;
      try {
        pacer.dispose();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).message).toBe('FramePacer#dispose(): more than one unsubscribe of the source threw');
      expect((thrown as AggregateError).errors).toEqual(errors);
    });

    test('the steps run no more', () => {
      const {pacer, listeners} = makePacer();
      const step = vi.fn();
      pacer.onFrame(step);
      // a source that keeps a listener it was asked to drop
      const stale = Array.from(listeners.frame);

      pacer.dispose();
      for (const listener of stale) listener(FRAME);

      expect(step).not.toHaveBeenCalled();
    });

    test('a step that disposes the pacer ends the run of the steps', () => {
      const {pacer, emitFrame} = makeSettledPacer();
      const behind = vi.fn();
      pacer.onFrame(() => pacer.dispose());
      pacer.onFrame(behind);

      emitFrame();

      expect(behind).not.toHaveBeenCalled();
    });

    describe('afterwards', () => {
      const makeDisposedPacer = () => {
        const made = makeSettledPacer();
        const step = vi.fn();
        const unsubscribe = made.pacer.onFrame(step);
        made.pacer.shouldDraw(FRAME);
        made.pacer.dispose();
        return {...made, unsubscribe};
      };

      test('shouldDraw() answers true and counts nothing: a frame handler that outlives its pacer never freezes the picture', () => {
        const {pacer} = makeDisposedPacer();

        expect(pacer.shouldDraw(FRAME)).toBe(true);
        expect(pacer.shouldDraw(FRAME)).toBe(true);
        expect([pacer.frames, pacer.draws]).toEqual([2, 1]);
      });

      test('report() and invalidate() do nothing', () => {
        const {pacer} = makeDisposedPacer();

        expect(() => {
          pacer.report(true);
          pacer.report('steady');
          pacer.invalidate();
        }).not.toThrow();
      });

      test('onFrame() throws: it promises a step that runs', () => {
        const {pacer} = makeDisposedPacer();

        expect(() => pacer.onFrame(() => true)).toThrow('FramePacer#onFrame() is not available: this pacer has been disposed');
      });

      test('an unsubscribe handed out before does nothing', () => {
        const {unsubscribe} = makeDisposedPacer();

        expect(() => unsubscribe()).not.toThrow();
      });

      test('steadyFps answers what it held', () => {
        const {pacer} = makeDisposedPacer();

        expect(pacer.steadyFps).toBe(30);
      });
    });
  });
});
