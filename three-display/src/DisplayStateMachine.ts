import eventize, {Eventize} from '@spearwolf/eventize';

export type DisplayStateName = 'new' | 'running' | 'paused';

export interface DisplayStateMachine extends Eventize {}

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
    if (elementIsInsideViewport !== this.#documentIsVisible) {
      this.#elementIsInsideViewport = elementIsInsideViewport;
      this.#elementIsInsideViewportChanged();
    }
  }

  #pausedByUserChanged = (): void => {
    switch (this.state) {
      case DisplayStateMachine.RUNNING:
        if (this.#pausedByUser) {
          this.pause();
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
          this.pause();
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
          this.pause();
        }
        break;
    }
  };

  pause(): void {
    if (this.state !== DisplayStateMachine.PAUSED) {
      this.state = DisplayStateMachine.PAUSED;
      this.emit(DisplayStateMachine.Pause);
    }
  }

  start(): void {
    if (
      this.state !== DisplayStateMachine.RUNNING &&
      !this.#pausedByUser &&
      this.#documentIsVisible &&
      this.#elementIsInsideViewport
    ) {
      switch (this.state) {
        case DisplayStateMachine.NEW:
          this.emit(DisplayStateMachine.Init);
          this.state = DisplayStateMachine.RUNNING;
          this.emit(DisplayStateMachine.Start);
          break;

        case DisplayStateMachine.PAUSED:
          this.emit(DisplayStateMachine.Restart);
          this.state = DisplayStateMachine.RUNNING;
          this.emit(DisplayStateMachine.Start);
          break;
      }
    }
  }
}
