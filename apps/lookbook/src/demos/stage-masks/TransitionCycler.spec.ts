import type {Display, StageDirector, StageDirectorLayer, StageTransitionEffect} from '@spearwolf/twopoint5d';
import {describe, expect, it, vi} from 'vitest';
import {TransitionCycler, type TransitionCyclerSettings} from './TransitionCycler';

interface FakeTransition {
  from: StageDirectorLayer;
  to: StageDirectorLayer;
  manual: boolean;
  progress: number;
  elapsed: number;
  duration: number;
  finished: Promise<FakeTransition>;
  cancel(jumpTo?: 'start' | 'end'): void;
}

/** Lets every promise that is settled by now run its handlers. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const listeners = {addEventListener: vi.fn(), removeEventListener: vi.fn()};
  vi.stubGlobal('window', listeners);

  const a = {name: 'a'} as unknown as StageDirectorLayer;
  const b = {name: 'b'} as unknown as StageDirectorLayer;
  const transitions: FakeTransition[] = [];
  const resolvers = new Map<FakeTransition, (t: FakeTransition) => void>();

  const director = {
    stack: [a] as StageDirectorLayer[],
    replace(from: StageDirectorLayer, to: StageDirectorLayer, opts: {manual: boolean; duration: number}): FakeTransition {
      let resolve!: (t: FakeTransition) => void;
      const finished = new Promise<FakeTransition>((r) => {
        resolve = r;
      });
      const transition: FakeTransition = {
        from,
        to,
        manual: opts.manual,
        progress: 0,
        elapsed: 0,
        duration: opts.duration,
        finished,
        cancel(jumpTo = 'start') {
          director.stack[0] = jumpTo === 'end' ? to : from;
          resolve(transition);
        },
      };
      resolvers.set(transition, resolve);
      transitions.push(transition);
      return transition;
    },
  };

  /** Lets `t` run out by itself. */
  const finish = (t: FakeTransition): void => {
    director.stack[0] = t.to;
    resolvers.get(t)?.(t);
  };

  const unsubscribe = vi.fn();
  const display = {onRenderFrame: vi.fn(() => unsubscribe)};
  const settings: TransitionCyclerSettings = {duration: 1, easing: 'linear', cycle: false, scrub: false, progress: 0.5};
  const log: string[] = [];

  const cycler = new TransitionCycler({
    display: display as unknown as Display,
    director: director as unknown as StageDirector,
    stages: [a, b],
    names: ['A', 'B'],
    settings,
    hold: 1,
    effect: () => ({}) as StageTransitionEffect,
    progress: () => 0,
    progressName: 'p',
    onBegin: () => log.push('begin'),
    onEnd: () => log.push('end'),
  });

  return {cycler, settings, log, transitions, finish, listeners, display, unsubscribe};
}

describe('TransitionCycler', () => {
  it('ends a run by the clock that the slider takes over, before the run by hand begins', async () => {
    const {cycler, settings, log, transitions} = setup();
    cycler.play();
    settings.scrub = true;
    cycler.setScrub();
    expect(log).toEqual(['begin', 'end', 'begin']);

    await transitions[0]!.finished;
    await settle();
    expect(log).toEqual(['begin', 'end', 'begin']);
  });

  it('ends a run by hand that restart() begins anew', async () => {
    const {cycler, log} = setup();
    cycler.holdAt(0.5);
    cycler.restart();
    expect(log).toEqual(['begin', 'end', 'begin']);

    await settle();
    expect(log).toEqual(['begin', 'end', 'begin']);
  });

  it('calls onEnd once for a run that runs out by itself, after its finished settles', async () => {
    const {cycler, log, transitions, finish} = setup();
    cycler.play();
    finish(transitions[0]!);
    expect(log).toEqual(['begin']);

    await settle();
    expect(log).toEqual(['begin', 'end']);
    expect(cycler.running).toBeUndefined();
  });

  it('ends a run by hand through cancel() as the slider lets go, and hears onEnd once through finished', async () => {
    const {cycler, settings, log, transitions} = setup();
    cycler.holdAt(0.5);
    const run = transitions[0]!;
    const cancel = vi.spyOn(run, 'cancel');
    settings.scrub = false;
    cycler.setScrub();
    expect(cancel).toHaveBeenCalledOnce();

    await settle();
    expect(log).toEqual(['begin', 'end']);
    expect(cycler.running).toBeUndefined();
  });

  it('takes its key listener and its frame listener off as it is disposed', () => {
    const {cycler, listeners, unsubscribe} = setup();
    cycler.dispose();
    expect(listeners.addEventListener).toHaveBeenCalledOnce();
    expect(listeners.removeEventListener).toHaveBeenCalledWith('keydown', listeners.addEventListener.mock.calls[0]![1]);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
