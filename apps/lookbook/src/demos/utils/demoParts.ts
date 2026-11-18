/** What `DemoParts` needs of a display: a `Display` passes as it is, a spec hands in a stand-in. */
export interface DemoPartsDisplay {
  readonly isDisposed: boolean;
  onDispose(release: () => void): unknown;
}

/**
 * What the init of a demo builds after an `await`, let go of as the display is disposed. Made
 * right after the init has asked `display.isDisposed`, it keeps each part the moment the part
 * exists: a part that throws as it is built leaves behind nothing that was built before it, and
 * the error stays the one `onDemoInit()` shows. The parts go in the reverse order they were kept
 * in — a mask before the stage it reads, a scene before the store whose textures it draws with —,
 * and each one goes even behind one whose release throws; that error is thrown once all of them
 * have gone, and the display throws it once it is down.
 */
export class DemoParts {
  readonly #releases: (() => void)[] = [];

  constructor(display: DemoPartsDisplay) {
    // a disposed display calls no onDispose() listener any more: nothing kept here would go
    if (display.isDisposed) {
      throw new Error('new DemoParts(): the display is disposed already, and nothing kept would go with it');
    }
    display.onDispose(() => this.#releaseAll());
  }

  /** Keeps `part` and answers it: its `dispose()` runs as the display is disposed. */
  keep<T extends {dispose(): void}>(part: T): T {
    this.#releases.push(() => part.dispose());
    return part;
  }

  /**
   * Runs `release` as the display is disposed, in its place among the kept parts: a listener
   * to take off, a timeout to clear, a lil-gui panel to destroy.
   */
  onDispose(release: () => void): void {
    this.#releases.push(release);
  }

  #releaseAll(): void {
    // last kept, first released, and every release runs, behind one that throws as well
    const errors: unknown[] = [];
    while (this.#releases.length > 0) {
      const release = this.#releases.pop();
      try {
        release?.();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, `DemoParts: ${errors.length} releases threw as the display was disposed`);
    }
  }
}
