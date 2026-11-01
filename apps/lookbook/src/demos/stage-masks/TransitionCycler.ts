import type {
  Display,
  IStage,
  StageDirector,
  StageDirectorLayer,
  StageTransition,
  StageTransitionEasing,
  StageTransitionEffect,
} from '@spearwolf/twopoint5d';
import type GUI from 'lil-gui';
import {ignoredKey} from '~demos/utils/demoKeys';

export interface TransitionCyclerSettings {
  duration: number;
  easing: StageTransitionEasing;
  cycle: boolean;
  scrub: boolean;
  progress: number;
}

export interface TransitionCyclerOptions {
  display: Display;
  director: StageDirector;
  /** the two pictures the slot changes between; the first one is in the slot at the start */
  stages: readonly [StageDirectorLayer, StageDirectorLayer];
  /** their names in the readout "in the slot", in the order of `stages` */
  names: readonly [string, string];
  /** the settings the GUI writes: the page's own object, which may carry more */
  settings: TransitionCyclerSettings;
  /** how long a picture holds before the next run while `cycle` is on, in seconds */
  hold: number;
  /** the effect of a run, asked as the run begins, after `onBegin` */
  effect: () => StageTransitionEffect;
  /** the progress the readout shows: that of the mask the effect of the run reads */
  progress: () => number;
  /** the name of that readout, as `heat.progress` */
  progressName: string;
  /** called as a run begins, before `effect()` and `replace()` */
  onBegin?: (from: StageDirectorLayer, to: StageDirectorLayer) => void;
  /** called as the run on the screen ends, before the readouts are written */
  onEnd?: () => void;
  /** further shortcuts of the page by `KeyboardEvent.code`, beside Space, Enter and S */
  keys?: Readonly<Record<string, () => void>>;
}

/**
 * The transition controls of the matte demos: one slot of a `StageDirector` that changes between
 * two pictures — played by the clock, scrubbed by hand with the progress slider, or cycled by
 * itself after a hold. The page brings the effect, the pictures and its hooks; the cycler keeps
 * the run on the screen, the keys (Space or Enter plays, S scrubs), the standard controllers of
 * lil-gui and the readouts of the slot, the time and the progress of the mask.
 */
export class TransitionCycler {
  readonly #options: TransitionCyclerOptions;
  readonly #readout: {slot: string; time: string; progress: string};
  readonly #unsubscribeFrame: () => void;
  #running: StageTransition | undefined;
  #hold: number;
  #disposed = false;

  // what the readouts show, compared in thousandths for time and progress
  #shownFrom: IStage | undefined;
  #shownTo: IStage | undefined;
  #shownTime = -1;
  #shownProgress: number;

  constructor(options: TransitionCyclerOptions) {
    this.#options = options;
    this.#hold = options.hold;
    const progress = options.progress();
    this.#readout = {slot: options.names[0], time: '—', progress: progress.toFixed(3)};
    this.#shownFrom = options.stages[0];
    this.#shownProgress = Math.round(progress * 1000);
    this.#unsubscribeFrame = options.display.onRenderFrame(({deltaTime}) => this.#onFrame(deltaTime));
    window.addEventListener('keydown', this.#onKeyDown);
  }

  /** the run on the screen, by the clock or by hand */
  get running(): StageTransition | undefined {
    return this.#running;
  }

  /** Begins a run by the clock, unless one is on the screen or the slider holds the slot. */
  play(): void {
    if (this.#running || this.#options.settings.scrub) return;
    this.#begin(false);
  }

  /**
   * Follows `settings.scrub`: on, a run by the clock ends where it was going and one by hand
   * begins at the slider; off, the run by hand ends at the end it is nearer to.
   */
  setScrub(): void {
    if (this.#options.settings.scrub) {
      this.#running?.cancel('end');
      this.#running = undefined;
      this.#begin(true);
    } else if (this.#running?.manual) {
      this.#running.cancel(this.#running.progress >= 0.5 ? 'end' : 'start');
    }
  }

  /**
   * Begins a run by hand again with the options of the page as they are now, at the same place of
   * the slider and in the same direction: `cancel('start')` leaves `from` in the slot. A run by the
   * clock keeps its options, the next one takes the new ones.
   */
  restart(): void {
    if (!this.#running?.manual) return;
    this.#running.cancel('start');
    this.#running = undefined;
    this.#begin(true);
  }

  /** Holds a run by hand at `progress`, with the cycle off: for the card of the lookbook. */
  holdAt(progress: number): void {
    const {settings} = this.#options;
    settings.cycle = false;
    settings.progress = progress;
    settings.scrub = true;
    this.setScrub();
  }

  /**
   * Adds the standard controllers to `gui`: duration, easing, play, cycle, scrub and progress,
   * then the readouts of the slot, the time and the progress of the mask. A page adds its own
   * controllers before, its own readouts after.
   */
  addControls(gui: GUI, duration: {min: number; max: number}): void {
    const {settings, progressName} = this.#options;
    gui.add(settings, 'duration', duration.min, duration.max, 0.1).name('duration (s)');
    gui.add(settings, 'easing', ['linear', 'ease-in', 'ease-out', 'ease-in-out']);
    gui.add({play: () => this.play()}, 'play').name('play (space)');
    gui.add(settings, 'cycle').name('cycle by itself');
    gui
      .add(settings, 'scrub')
      .name('scrub by hand (s)')
      .onChange(() => this.setScrub())
      .listen();
    gui
      .add(settings, 'progress', 0, 1, 0.001)
      .name('transition.progress')
      .onChange(() => {
        if (this.#running?.manual) this.#running.progress = settings.progress;
      });
    gui.add(this.#readout, 'slot').name('in the slot').disable().listen();
    gui.add(this.#readout, 'time').name('time / duration').disable().listen();
    gui.add(this.#readout, 'progress').name(progressName).disable().listen();
  }

  dispose(): void {
    this.#disposed = true;
    window.removeEventListener('keydown', this.#onKeyDown);
    this.#unsubscribeFrame();
  }

  #onFrame(deltaTime: number): void {
    const {settings} = this.#options;
    if (settings.cycle && !settings.scrub && !this.#running) {
      this.#hold -= deltaTime;
      if (this.#hold <= 0) this.#begin(false);
    }
    this.#describe();
  }

  #begin(manual: boolean): void {
    const {director, stages, settings, onBegin, effect} = this.#options;
    const from = director.stack[0] === stages[1] ? stages[1] : stages[0];
    const to = from === stages[1] ? stages[0] : stages[1];
    onBegin?.(from, to);
    const transition = director.replace(from, to, {
      effect: effect(),
      duration: settings.duration,
      easing: settings.easing,
      manual,
    });
    if (manual) transition.progress = settings.progress;
    this.#running = transition;
    transition.finished.then((t) => {
      if (this.#disposed) return;
      if (this.#running === t) {
        this.#running = undefined;
        this.#options.onEnd?.();
      }
      this.#hold = this.#options.hold;
      this.#describe();
    });
  }

  // the readouts, written only when what they show changes: during a run the slot names both ends
  #describe(): void {
    const running = this.#running;
    const from = running ? running.from : this.#options.director.stack[0];
    const to = running ? running.to : undefined;
    if (from !== this.#shownFrom || to !== this.#shownTo) {
      this.#shownFrom = from;
      this.#shownTo = to;
      this.#readout.slot = to === undefined ? this.#nameOf(from) : `${this.#nameOf(from)} → ${this.#nameOf(to)}`;
    }
    // -1 for no run, -2 for a run by hand, else the share of the duration in thousandths
    const time = running ? (running.manual ? -2 : Math.round(Math.min(1, running.elapsed / running.duration) * 1000)) : -1;
    if (time !== this.#shownTime) {
      this.#shownTime = time;
      this.#readout.time = time === -1 ? '—' : time === -2 ? 'by hand' : (time / 1000).toFixed(3);
    }
    const progress = Math.round(this.#options.progress() * 1000);
    if (progress !== this.#shownProgress) {
      this.#shownProgress = progress;
      this.#readout.progress = (progress / 1000).toFixed(3);
    }
  }

  #nameOf(stage: IStage | undefined): string {
    const {stages, names} = this.#options;
    return stage === stages[1] ? names[1] : names[0];
  }

  // Space or Enter plays, S scrubs by hand, the keys of the page do the rest
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (ignoredKey(event) || event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      this.play();
    } else if (event.code === 'KeyS') {
      this.#options.settings.scrub = !this.#options.settings.scrub;
      this.setScrub();
    } else {
      this.#options.keys?.[event.code]?.();
    }
  };
}
