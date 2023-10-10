import {DisplayStateMachine} from './DisplayStateMachine.js';

const createEventMocks = () => ({
  [DisplayStateMachine.Init]: jest.fn(),
  [DisplayStateMachine.Start]: jest.fn(),
  [DisplayStateMachine.Pause]: jest.fn(),
  [DisplayStateMachine.Restart]: jest.fn(),
});

describe('DisplayStateMachine', () => {
  it('create', () => {
    const stateMachine = new DisplayStateMachine();

    expect(stateMachine.state).toBe(DisplayStateMachine.NEW);
  });

  it('start', () => {
    const stateMachine = new DisplayStateMachine();

    const eventMocks = createEventMocks();
    stateMachine.on(eventMocks);

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
    stateMachine.on(eventMocks);

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
    stateMachine.on(eventMocks);

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
    stateMachine.on(eventMocks);

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
    stateMachine.on(eventMocks);

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

    stateMachine.off(eventMocks);
    eventMocks = createEventMocks();
    stateMachine.on(eventMocks);

    stateMachine.pausedByUser = false;
    stateMachine.documentIsVisible = true;
    stateMachine.elementIsInsideViewport = true;

    expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);

    expect(eventMocks[DisplayStateMachine.Init]).toBeCalledTimes(1);
    expect(eventMocks[DisplayStateMachine.Start]).toBeCalledTimes(1);
    expect(eventMocks[DisplayStateMachine.Pause]).not.toBeCalled();
    expect(eventMocks[DisplayStateMachine.Restart]).not.toBeCalled();
  });
});
