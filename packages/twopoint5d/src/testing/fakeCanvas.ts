/**
 * One call a {@link FakeCanvasContext} recorded, with the state of the context in force at that moment:
 * the image smoothing, the translation of the transform, the global alpha and the composite operation.
 */
export interface FakeCanvasCall {
  readonly op: string;
  readonly args: readonly unknown[];
  readonly imageSmoothingEnabled: boolean;
  readonly translation: readonly [x: number, y: number];
  readonly globalAlpha: number;
  readonly globalCompositeOperation: string;
}

interface FakeCanvasState {
  imageSmoothingEnabled: boolean;
  fillStyle: unknown;
  font: string;
  globalAlpha: number;
  globalCompositeOperation: string;
  translation: [x: number, y: number];
}

/**
 * The 2D context of a {@link FakeCanvas}: it draws nothing and records every call it is given, so a
 * spec under Node — no canvas there — can hold code that draws to what it asked for. `save()` and
 * `restore()` keep the state a real context keeps; the transform is followed as a translation alone —
 * `translate()` moves it, `setTransform()` sets it to its `e` and `f`.
 */
export class FakeCanvasContext {
  readonly calls: FakeCanvasCall[] = [];
  imageSmoothingEnabled = true;
  fillStyle: unknown = '#000';
  font = '10px sans-serif';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  #translation: [x: number, y: number] = [0, 0];

  readonly #stack: FakeCanvasState[] = [];

  constructor(readonly canvas: FakeCanvas) {}

  #record(op: string, args: readonly unknown[]): void {
    this.calls.push({
      op,
      args,
      imageSmoothingEnabled: this.imageSmoothingEnabled,
      translation: [this.#translation[0], this.#translation[1]],
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }

  /** The calls of one kind, in the order they came. */
  callsOf(op: string): FakeCanvasCall[] {
    return this.calls.filter((call) => call.op === op);
  }

  /** The calls that draw or clear — every one but `save`, `restore`, `setTransform`, `translate`, `beginPath`, `rect` and `clip`. */
  get drawCalls(): FakeCanvasCall[] {
    const bookkeeping = new Set(['save', 'restore', 'setTransform', 'translate', 'beginPath', 'rect', 'clip']);
    return this.calls.filter((call) => !bookkeeping.has(call.op));
  }

  save(): void {
    this.#stack.push({
      imageSmoothingEnabled: this.imageSmoothingEnabled,
      fillStyle: this.fillStyle,
      font: this.font,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      translation: [this.#translation[0], this.#translation[1]],
    });
    this.#record('save', []);
  }

  restore(): void {
    const state = this.#stack.pop();
    if (state) {
      this.imageSmoothingEnabled = state.imageSmoothingEnabled;
      this.fillStyle = state.fillStyle;
      this.font = state.font;
      this.globalAlpha = state.globalAlpha;
      this.globalCompositeOperation = state.globalCompositeOperation;
      this.#translation = state.translation;
    }
    this.#record('restore', []);
  }

  setTransform(...args: number[]): void {
    this.#translation = [args[4] ?? 0, args[5] ?? 0];
    this.#record('setTransform', args);
  }

  beginPath(): void {
    this.#record('beginPath', []);
  }

  rect(...args: number[]): void {
    this.#record('rect', args);
  }

  clip(): void {
    this.#record('clip', []);
  }

  translate(...args: number[]): void {
    this.#translation = [this.#translation[0] + (args[0] ?? 0), this.#translation[1] + (args[1] ?? 0)];
    this.#record('translate', args);
  }

  clearRect(...args: number[]): void {
    this.#record('clearRect', args);
  }

  fillRect(...args: number[]): void {
    this.#record('fillRect', [this.fillStyle, ...args]);
  }

  drawImage(...args: unknown[]): void {
    this.#record('drawImage', args);
  }

  measureText(text: string): {width: number} {
    return {width: text.length * 6};
  }
}

/** A canvas for specs under Node: its size can be set, and its 2D context records instead of drawing. */
export class FakeCanvas {
  width: number;
  height: number;
  readonly context: FakeCanvasContext;
  /** What `getContext('2d')` answers — `null` stands for a canvas that holds a context of another kind. */
  context2d: FakeCanvasContext | null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.context = new FakeCanvasContext(this);
    this.context2d = this.context;
  }

  getContext(kind: string): FakeCanvasContext | null {
    return kind === '2d' ? this.context2d : null;
  }
}

/** The canvas type the library's signatures take, for a {@link FakeCanvas} handed to them. */
export const asCanvas = (canvas: FakeCanvas): HTMLCanvasElement => canvas as unknown as HTMLCanvasElement;
