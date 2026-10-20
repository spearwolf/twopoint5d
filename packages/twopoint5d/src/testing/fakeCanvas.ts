/** One call a {@link FakeCanvasContext} recorded, with the image smoothing in force at that moment. */
export interface FakeCanvasCall {
  readonly op: string;
  readonly args: readonly unknown[];
  readonly imageSmoothingEnabled: boolean;
}

/**
 * The 2D context of a {@link FakeCanvas}: it draws nothing and records every call it is given, so a
 * spec under Node — no canvas there — can hold code that draws to what it asked for. `save()` and
 * `restore()` keep `imageSmoothingEnabled` and `fillStyle` the way a real context does.
 */
export class FakeCanvasContext {
  readonly calls: FakeCanvasCall[] = [];
  imageSmoothingEnabled = true;
  fillStyle: unknown = '#000';

  readonly #stack: {imageSmoothingEnabled: boolean; fillStyle: unknown}[] = [];

  constructor(readonly canvas: FakeCanvas) {}

  #record(op: string, args: readonly unknown[]): void {
    this.calls.push({op, args, imageSmoothingEnabled: this.imageSmoothingEnabled});
  }

  /** The calls of one kind, in the order they came. */
  callsOf(op: string): FakeCanvasCall[] {
    return this.calls.filter((call) => call.op === op);
  }

  save(): void {
    this.#stack.push({imageSmoothingEnabled: this.imageSmoothingEnabled, fillStyle: this.fillStyle});
    this.#record('save', []);
  }

  restore(): void {
    const state = this.#stack.pop();
    if (state) {
      this.imageSmoothingEnabled = state.imageSmoothingEnabled;
      this.fillStyle = state.fillStyle;
    }
    this.#record('restore', []);
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
