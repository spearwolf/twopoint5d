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
    let toggled = false;
    on(stateMachine, DisplayStateMachine.Restart, () => {
      // the toggle below restarts from inside this listener, which the restart reaches again
      if (toggled) return;
      toggled = true;
      stateMachine.pausedByUser = true;
      stateMachine.pausedByUser = false;
    });

    stateMachine.pausedByUser = false;

    expect(events).toEqual([DisplayStateMachine.Restart, DisplayStateMachine.Restart, DisplayStateMachine.Start]);
    expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);
  });

  it('a restart listener whose nested restart ends in a new pause leaves that pause as the only one', () => {
    const stateMachine = new DisplayStateMachine();
    stateMachine.start();
    stateMachine.pausedByUser = true;
    const events = recordEvents(stateMachine);
    let toggled = false;
    on(stateMachine, DisplayStateMachine.Restart, () => {
      if (toggled) return;
      toggled = true;
      stateMachine.pausedByUser = true;
      stateMachine.pausedByUser = false;
      stateMachine.pausedByUser = true;
    });

    stateMachine.pausedByUser = false;

    // the state is PAUSED again, as it was before the outer restart went out, and still the
    // outer restart has nothing left to do: the nested one has run to its end
    expect(events).toEqual([
      DisplayStateMachine.Restart,
      DisplayStateMachine.Restart,
      DisplayStateMachine.Start,
      DisplayStateMachine.Pause,
    ]);
    expect(stateMachine.state).toBe(DisplayStateMachine.PAUSED);
  });
});
