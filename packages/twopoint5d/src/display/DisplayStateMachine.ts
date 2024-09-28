import {emit, eventize} from '@spearwolf/eventize';

export type DisplayStateName = 'new' | 'running' | 'paused';

export class DisplayStateMachine {
  static NEW: DisplayStateName = 'new';
  static RUNNING: DisplayStateName = 'running';
  static PAUSED: DisplayStateName = 'paused';

  static Init = 'init';
  static Start = 'start';
  static Pause = 'pause';
  static Restart = 'restart';

  state: DisplayStateName = DisplayStateMachine.NEW;

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
    switch (this.state) {
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
    switch (this.state) {
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
    switch (this.state) {
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
    if (this.state !== DisplayStateMachine.PAUSED) {
      this.state = DisplayStateMachine.PAUSED;
      emit(this, DisplayStateMachine.Pause);
    }
  };

  #initMustBeCalled = true;

  #initOrRestart = (): void => {
    if (this.#initMustBeCalled) {
      this.#initMustBeCalled = false;
      emit(this, DisplayStateMachine.Init);
    } else {
      emit(this, DisplayStateMachine.Restart);
    }
  };

  start(): void {
    if (this.state !== DisplayStateMachine.RUNNING) {
      const isPaused = this.#pausedByUser || !this.#documentIsVisible || !this.#elementIsInsideViewport;

      switch (this.state) {
        case DisplayStateMachine.NEW:
          if (!isPaused) {
            this.#initOrRestart();
            this.state = DisplayStateMachine.RUNNING;
            emit(this, DisplayStateMachine.Start);
          } else {
            this.#pause();
          }
          break;

        case DisplayStateMachine.PAUSED:
          if (!isPaused) {
            this.#initOrRestart();
            this.state = DisplayStateMachine.RUNNING;
            emit(this, DisplayStateMachine.Start);
          }
          break;
      }
    }
  }
}
