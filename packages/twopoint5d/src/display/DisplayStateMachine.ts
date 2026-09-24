import {emit, emitStrict, type EventizedObject, eventize} from '@spearwolf/eventize';

export type DisplayStateName = 'new' | 'running' | 'paused';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DisplayStateMachine extends EventizedObject {}

export class DisplayStateMachine {
  static NEW: DisplayStateName = 'new';
  static RUNNING: DisplayStateName = 'running';
  static PAUSED: DisplayStateName = 'paused';

  static Init = 'init';
  static Start = 'start';
  static Pause = 'pause';
  static Restart = 'restart';

  #state: DisplayStateName = DisplayStateMachine.NEW;

  get state(): DisplayStateName {
    return this.#state;
  }

  get isNew(): boolean {
    return this.#state === DisplayStateMachine.NEW;
  }

  get isRunning(): boolean {
    return this.#state === DisplayStateMachine.RUNNING;
  }

  get isPaused(): boolean {
    return this.#state === DisplayStateMachine.PAUSED;
  }

  #pausedByUser = false;
  #documentIsVisible = true;
  #elementIsInsideViewport = true;

  constructor() {
    eventize(this);
  }

  get pausedByUser(): boolean {
    return this.#pausedByUser;
  }

  set pausedByUser(pausedByUser: boolean) {
    if (pausedByUser !== this.#pausedByUser) {
      this.#pausedByUser = pausedByUser;
      this.#pausedByUserChanged();
    }
  }

  get documentIsVisible(): boolean {
    return this.#documentIsVisible;
  }

  set documentIsVisible(documentIsVisible: boolean) {
    if (documentIsVisible !== this.#documentIsVisible) {
      this.#documentIsVisible = documentIsVisible;
      this.#documentIsVisibleChanged();
    }
  }

  get elementIsInsideViewport(): boolean {
    return this.#elementIsInsideViewport;
  }

  set elementIsInsideViewport(elementIsInsideViewport: boolean) {
    if (elementIsInsideViewport !== this.#elementIsInsideViewport) {
      this.#elementIsInsideViewport = elementIsInsideViewport;
      this.#elementIsInsideViewportChanged();
    }
  }

  #pausedByUserChanged = (): void => {
    switch (this.#state) {
      case DisplayStateMachine.RUNNING:
        if (this.#pausedByUser) {
          this.#pause();
        }
        break;

      case DisplayStateMachine.PAUSED:
        if (!this.#pausedByUser) {
          this.start();
        }
        break;
    }
  };

  #documentIsVisibleChanged = (): void => {
    switch (this.#state) {
      case DisplayStateMachine.RUNNING:
      case DisplayStateMachine.PAUSED:
        if (this.#documentIsVisible) {
          this.start();
        } else {
          this.#pause();
        }
        break;
    }
  };

  #elementIsInsideViewportChanged = (): void => {
    switch (this.#state) {
      case DisplayStateMachine.RUNNING:
      case DisplayStateMachine.PAUSED:
        if (this.#elementIsInsideViewport) {
          this.start();
        } else {
          this.#pause();
        }
        break;
    }
  };

  #pause = (): void => {
    if (this.#state !== DisplayStateMachine.PAUSED) {
      this.#state = DisplayStateMachine.PAUSED;
      // every listener hears pause, even behind one that throws
      emitStrict(this, DisplayStateMachine.Pause);
    }
  };

  // set while the listeners of Init or Restart run. A start() from one of them does nothing:
  // the call that emitted the event reads the inputs once they are through and emits the one
  // Start or Pause that follows — a nested start would emit a Restart before either
  #emittingInitOrRestart = false;

  #isPaused(): boolean {
    return this.#pausedByUser || !this.#documentIsVisible || !this.#elementIsInsideViewport;
  }

  #initOrRestartThenStart(): void {
    this.#emittingInitOrRestart = true;
    try {
      this.#initOrRestart();
    } finally {
      this.#emittingInitOrRestart = false;
    }

    // the listeners of Init and Restart run while the state is still NEW or PAUSED, where a
    // change of the inputs moves nothing and start() does nothing. So the inputs are read here:
    // a pause one of them asked for holds, and whoever heard init or restart hears pause next
    if (this.#isPaused()) {
      this.#state = DisplayStateMachine.PAUSED;
      emitStrict(this, DisplayStateMachine.Pause);
    } else {
      this.#state = DisplayStateMachine.RUNNING;
      try {
        // every listener hears start, even behind one that throws
        emitStrict(this, DisplayStateMachine.Start);
      } catch (startError) {
        // the listeners that heard start hear pause next, and the pause is the user's: a tab
        // that comes back does not start again what failed to start — the next start() does
        this.#pausedByUser = true;
        try {
          this.#pause();
        } catch (pauseError) {
          // neither error goes missing: the one of the start, and the one of the pause after it
          throw new AggregateError(
            [startError, pauseError],
            'start(): a listener of start threw, and a listener of pause threw in the pause that followed',
            {cause: pauseError},
          );
        }
        throw startError;
      }
    }
  }

  #initMustBeCalled = true;

  #initOrRestart = (): void => {
    if (this.#initMustBeCalled) {
      emit(this, DisplayStateMachine.Init);
      // cleared once every listener is through: a listener that throws leaves the init to the next
      // start(). None of them gets back in here, since start() does nothing while they run
      this.#initMustBeCalled = false;
    } else {
      emit(this, DisplayStateMachine.Restart);
    }
  };

  start(): void {
    if (this.#emittingInitOrRestart) return;
    if (this.#state !== DisplayStateMachine.RUNNING) {
      const isPaused = this.#isPaused();

      switch (this.#state) {
        case DisplayStateMachine.NEW:
          if (!isPaused) {
            this.#initOrRestartThenStart();
          } else {
            this.#pause();
          }
          break;

        case DisplayStateMachine.PAUSED:
          if (!isPaused) {
            this.#initOrRestartThenStart();
          }
          break;
      }
    }
  }
}
