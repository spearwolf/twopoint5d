// The `renderOrder` of a `StageRenderer`: its value, its entries, and the snapshot of the stages
// in that order. This module is not in `public-api.ts`: only `StageRenderer` reaches it.

import type {StageItem} from './StageRenderer.js';

export class StageRenderOrder {
  #value = '*';
  #entries?: string[];
  #snapshot?: StageItem[];
  #snapshotNames: string[] = [];

  readonly #onRename: () => void;

  /**
   * @param onRename Runs when a renamed stage makes {@link snapshot} drop the snapshot it had —
   * only while the order lists names.
   */
  constructor(onRename: () => void) {
    this.#onRename = onRename;
  }

  /** The order as written: a comma separated list of stage names, or `'*'`. */
  get value(): string {
    return this.#value;
  }

  /**
   * Takes `value`, `'*'` for an empty one. Answers `false` and changes nothing for the value it
   * has; otherwise drops the entries and the snapshot and answers `true`.
   */
  set(value: string | undefined): boolean {
    value = value || '*';
    if (this.#value === value) return false;
    this.#value = value;
    this.#entries = undefined;
    this.#snapshot = undefined;
    return true;
  }

  /**
   * The entries of the order, split at the commas, trimmed, empty ones left out — the entries
   * themselves, not a copy. The frame path reads the entries through here;
   * `StageRenderer#renderOrderArray` hands out a copy.
   */
  entries(): readonly string[] {
    if (!this.#entries) {
      this.#entries = this.#value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return this.#entries;
  }

  /** The names the order places explicitly: every entry except `'*'`. */
  listedNames(): Set<string> {
    return new Set(this.entries().filter((name) => name !== '*'));
  }

  /** Drops the snapshot: the next {@link snapshot} builds a new one. For `add()` and `remove()`. */
  invalidate(): void {
    this.#snapshot = undefined;
  }

  /**
   * The stages in this order, as a snapshot that stands until the order, the list of stages or —
   * while the order lists names — the name of a stage changes.
   */
  snapshot(stages: ReadonlyArray<StageItem>): ReadonlyArray<StageItem> {
    const renderOrder = this.entries();
    // no name listed: a rename moves no stage, so the snapshot holds no names and stands until
    // add(), remove() or a write to renderOrder — a rename rebuilds neither it nor the output
    // node
    const everyStageInOrder = renderOrder.length === 0 || (renderOrder.length === 1 && renderOrder[0] === '*');

    if (this.#snapshot) {
      // a stage name is a plain mutable field: the cache holds the names it was built from and
      // rebuilds when one of them moved
      if (everyStageInOrder || this.#hasSnapshotNames(stages)) return this.#snapshot;
      // a renamed stage can move to another position, and the pass nodes follow the order
      this.#onRename();
    }

    if (everyStageInOrder) {
      // a copy, never the list itself: add() and remove() change that list, and a snapshot
      // handed out does not change after it
      this.#snapshot = stages.slice();
      return this.#snapshot;
    }

    const listed = this.listedNames();
    const byName = new Map<string, StageItem[]>();
    const rest: StageItem[] = [];

    for (const item of stages) {
      const {name} = item.stage;
      if (listed.has(name)) {
        const items = byName.get(name);
        if (items) {
          items.push(item);
        } else {
          byName.set(name, [item]);
        }
      } else {
        rest.push(item);
      }
    }

    // a name or '*' listed twice counts at its first position, so every stage is placed once
    const orderedStages: StageItem[] = [];
    const placed = new Set<string>();
    let restPlaced = false;

    for (const name of renderOrder) {
      if (name === '*') {
        if (!restPlaced) {
          restPlaced = true;
          orderedStages.push(...rest);
        }
      } else if (!placed.has(name)) {
        placed.add(name);
        const items = byName.get(name);
        if (items) orderedStages.push(...items);
      }
    }

    this.#snapshot = orderedStages;
    this.#snapshotNames = stages.map((item) => item.stage.name);

    return orderedStages;
  }

  /**
   * Warns about every name of `names` that the order lists and more than one of `stages`
   * carries.
   */
  warnAboutSharedNames(stages: ReadonlyArray<StageItem>, names: Iterable<string>): void {
    // only a name that renderOrder lists has to be told apart: stages under any other name go
    // with the rest behind '*', or are not drawn at all, whatever they are called
    const listed = this.listedNames();

    for (const name of new Set(names)) {
      if (!listed.has(name)) continue;
      let count = 0;
      for (const item of stages) {
        if (item.stage.name === name) count++;
      }
      if (count > 1) {
        // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
        console.warn(
          `StageRenderer: ${count} stages are named ${JSON.stringify(name)} and renderOrder=${JSON.stringify(this.#value)} cannot tell them apart; they render in the order they were added. Set unique names on your stages.`,
        );
      }
    }
  }

  #hasSnapshotNames(stages: ReadonlyArray<StageItem>): boolean {
    const names = this.#snapshotNames;
    if (names.length !== stages.length) return false;
    for (let i = 0; i < names.length; i++) {
      if (names[i] !== stages[i]!.stage.name) return false;
    }
    return true;
  }
}
