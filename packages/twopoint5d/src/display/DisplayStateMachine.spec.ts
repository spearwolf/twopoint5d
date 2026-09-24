import {off, on, once} from '@spearwolf/eventize';
import {describe, expect, it, vi} from 'vitest';
import {DisplayStateMachine} from './DisplayStateMachine.js';

const EVENTS = [DisplayStateMachine.Init, DisplayStateMachine.Start, DisplayStateMachine.Pause, DisplayStateMachine.Restart];

/** Writes the name of every event the state machine emits into one list, in emission order. */
const recordEvents = (stateMachine: DisplayStateMachine) => {
  const events: string[] = [];
  for (const name of EVENTS) {
    on(stateMachine, name, () => {
      events.push(name);
    });
  }
  return events;
};

const createEventMocks = () => ({
  [DisplayStateMachine.Init]: vi.fn(),
  [DisplayStateMachine.Start]: vi.fn(),
  [DisplayStateMachine.Pause]: vi.fn(),
  [DisplayStateMachine.Restart]: vi.fn(),
});

describe('DisplayStateMachine', () => {
  it('create', () => {
    const stateMachine = new DisplayStateMachine();

    expect(stateMachine.state).toBe(DisplayStateMachine.NEW);
  });

  it('state is an accessor without a setter', () => {
    const stateMachine = new DisplayStateMachine();

    const descriptor = Object.getOwnPropertyDescriptor(DisplayStateMachine.prototype, 'state');
    expect(descriptor?.get, 'state has a getter').toBeTypeOf('function');
    expect(descriptor?.set, 'state has no setter').toBeUndefined();

    expect(() => {
      (stateMachine as unknown as Record<string, unknown>)['state'] = DisplayStateMachine.RUNNING;
    }, 'a write to state').toThrow(TypeError);
    expect(stateMachine.state, 'state after the write').toBe(DisplayStateMachine.NEW);
  });

  it('start', () => {
    const stateMachine = new DisplayStateMachine();

    const eventMocks = createEventMocks();
    on(stateMachine, eventMocks);

    stateMachine.start();

    expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);

    expect(eventMocks[DisplayStateMachine.Init]).toBeCalled();
    expect(eventMocks[DisplayStateMachine.Start]).toBeCalled();
    expect(eventMocks[DisplayStateMachine.Pause]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Restart]).not.toBeCalled();
  });

  it('start -> pausedByUser', () => {
    const stateMachine = new DisplayStateMachine();
    stateMachine.start();

    const eventMocks = createEventMocks();
    on(stateMachine, eventMocks);

    stateMachine.pausedByUser = true;

    expect(stateMachine.state).toBe(DisplayStateMachine.PAUSED);

    expect(eventMocks[DisplayStateMachine.Init]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Start]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Pause]).toBeCalled();
    expect(eventMocks[DisplayStateMachine.Restart]).not.toBeCalled();
  });

  it('start -> pausedByUser -> !pausedByUser', () => {
    const stateMachine = new DisplayStateMachine();
    stateMachine.start();
    stateMachine.pausedByUser = true;

    const eventMocks = createEventMocks();
    on(stateMachine, eventMocks);

    stateMachine.pausedByUser = false;

    expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);

    expect(eventMocks[DisplayStateMachine.Init]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Start]).toBeCalled();
    expect(eventMocks[DisplayStateMachine.Pause]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Restart]).toBeCalled();
  });

  it('start -> pausedByUser,documentIsVisible -> !pausedByUser', () => {
    const stateMachine = new DisplayStateMachine();
    stateMachine.start();
    stateMachine.pausedByUser = true;
    stateMachine.documentIsVisible = false;

    const eventMocks = createEventMocks();
    on(stateMachine, eventMocks);

    stateMachine.pausedByUser = false;

    expect(stateMachine.state).toBe(DisplayStateMachine.PAUSED);

    expect(eventMocks[DisplayStateMachine.Init]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Start]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Pause]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Restart]).not.toBeCalled();
  });

  it('before start and after', () => {
    const stateMachine = new DisplayStateMachine();

    let eventMocks = createEventMocks();
    on(stateMachine, eventMocks);

    stateMachine.pausedByUser = true;
    stateMachine.documentIsVisible = false;
    stateMachine.elementIsInsideViewport = false;

    // before start() state is NEW!
    expect(stateMachine.state).toBe(DisplayStateMachine.NEW);

    // .. and no events are emitted before
    expect(eventMocks[DisplayStateMachine.Init]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Start]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Pause]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Restart]).not.toBeCalled();

    stateMachine.start();

    expect(stateMachine.state).toBe(DisplayStateMachine.PAUSED);

    expect(eventMocks[DisplayStateMachine.Init]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Start]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Pause]).toBeCalled();
    expect(eventMocks[DisplayStateMachine.Restart]).not.toBeCalled();

    off(stateMachine, eventMocks);

    eventMocks = createEventMocks();
    on(stateMachine, eventMocks);

    stateMachine.pausedByUser = false;
    stateMachine.documentIsVisible = true;
    stateMachine.elementIsInsideViewport = true;

    expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);

    expect(eventMocks[DisplayStateMachine.Init]).toBeCalledTimes(1);
    expect(eventMocks[DisplayStateMachine.Start]).toBeCalledTimes(1);
    expect(eventMocks[DisplayStateMachine.Pause]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Restart]).not.toBeCalled();
  });

  it('a pause set by an init listener holds the state machine in the pause', () => {
    const stateMachine = new DisplayStateMachine();
    const events = recordEvents(stateMachine);
    once(stateMachine, DisplayStateMachine.Init, () => {
      stateMachine.pausedByUser = true;
    });

    stateMachine.start();

    expect(events).toEqual([DisplayStateMachine.Init, DisplayStateMachine.Pause]);
    expect(stateMachine.state).toBe(DisplayStateMachine.PAUSED);

    stateMachine.pausedByUser = false;

    expect(events).toEqual([
      DisplayStateMachine.Init,
      DisplayStateMachine.Pause,
      DisplayStateMachine.Restart,
      DisplayStateMachine.Start,
    ]);
    expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);
  });

  it('an init listener that calls start() gets no restart: init, then start', () => {
    const stateMachine = new DisplayStateMachine();
    const events = recordEvents(stateMachine);
    once(stateMachine, DisplayStateMachine.Init, () => {
      stateMachine.start();
    });

    stateMachine.start();

    expect(events).toEqual([DisplayStateMachine.Init, DisplayStateMachine.Start]);
    expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);
  });

  it('a pause set by a restart listener holds the state machine in the pause', () => {
    const stateMachine = new DisplayStateMachine();
    stateMachine.start();
    stateMachine.pausedByUser = true;
    const events = recordEvents(stateMachine);
    once(stateMachine, DisplayStateMachine.Restart, () => {
      stateMachine.pausedByUser = true;
    });

    stateMachine.pausedByUser = false;

    expect(events).toEqual([DisplayStateMachine.Restart, DisplayStateMachine.Pause]);
    expect(stateMachine.state).toBe(DisplayStateMachine.PAUSED);
  });

  it('a restart listener that pauses and un-pauses restarts the state machine once, with one start', () => {
    const stateMachine = new DisplayStateMachine();
    stateMachine.start();
    stateMachine.pausedByUser = true;
    const events = recordEvents(stateMachine);
    once(stateMachine, DisplayStateMachine.Restart, () => {
      stateMachine.pausedByUser = true;
      stateMachine.pausedByUser = false;
    });

    stateMachine.pausedByUser = false;

    expect(events).toEqual([DisplayStateMachine.Restart, DisplayStateMachine.Start]);
    expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);
  });

  it('a restart listener that pauses, un-pauses and pauses again holds the state machine in the pause', () => {
    const stateMachine = new DisplayStateMachine();
    stateMachine.start();
    stateMachine.pausedByUser = true;
    const events = recordEvents(stateMachine);
    once(stateMachine, DisplayStateMachine.Restart, () => {
      stateMachine.pausedByUser = true;
      stateMachine.pausedByUser = false;
      stateMachine.pausedByUser = true;
    });

    stateMachine.pausedByUser = false;

    expect(events).toEqual([DisplayStateMachine.Restart, DisplayStateMachine.Pause]);
    expect(stateMachine.state).toBe(DisplayStateMachine.PAUSED);
  });

  it('an init listener that throws leaves the state machine new, and the next start() emits init again', () => {
    const stateMachine = new DisplayStateMachine();

    // a listener ahead of the one that throws hears init on both attempts
    const early: string[] = [];
    on(stateMachine, DisplayStateMachine.Init, () => {
      early.push(DisplayStateMachine.Init);
    });

    let fail = true;
    on(stateMachine, DisplayStateMachine.Init, () => {
      if (fail) throw new Error('init listener');
    });

    const events = recordEvents(stateMachine);

    expect(() => stateMachine.start()).toThrow('init listener');
    expect(stateMachine.state).toBe(DisplayStateMachine.NEW);
    expect(events).toEqual([]);

    fail = false;
    stateMachine.start();

    expect(events).toEqual([DisplayStateMachine.Init, DisplayStateMachine.Start]);
    expect(early).toEqual([DisplayStateMachine.Init, DisplayStateMachine.Init]);
    expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);
  });
});
