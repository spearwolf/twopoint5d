import {uniform} from 'three/tsl';
import type {UniformNode} from 'three/webgpu';
import {SeededRandom} from '~demos/utils/seededRandom';
import type {RoomJson} from './chapelAssets.js';
import {smoothstepCpu} from './helpers.js';

/** One round of the séance, in seconds. */
const ROUND = 46;
/** What the planchette spells, letter by letter, and when. */
const SPELL = ['I', 'S', 'E', 'E', 'Y', 'O', 'U'];
const SPELL_START = 2;
const SPELL_STEP = 1.9;
const SPELL_END = SPELL_START + SPELL.length * SPELL_STEP;
/** when each head starts to turn to the window, how long it takes, when it turns back */
const TURNS = [
  {start: 17.2, take: 6.5},
  {start: 15.6, take: 5},
  {start: 16.4, take: 5.5},
  {start: 15, take: 9},
];
const TURN_BACK = 37;

const ease = (t: number) => smoothstepCpu(0, 1, t);

/**
 * The clock of the séance, shared by every stage: the time, the flicker of each candle, how far
 * each head has turned to the window, where the planchette is, and how strong the ectoplasm is.
 * {@link update} once per frame, before anything reads it.
 */
export class SeanceClock {
  readonly time = uniform(0);
  /** 0 … 1 per candle and stand, a flicker that every stage reads alike */
  readonly flicker: UniformNode<'float', number>[] = [];
  /** the mean of the flickers */
  readonly glow = uniform(1);
  /** 0 … 1, how much ectoplasm rises from the board */
  readonly ecto = uniform(0);
  /** 0 … 1 per head, how far it has turned to the window */
  readonly turn = TURNS.map(() => 0);
  /** the planchette, in room units, and its turn */
  planchetteX = 0;
  planchetteY = 0;
  planchetteRot = 0;
  /** the seconds into the round */
  round = 0;

  /** the mark of each letter of `SPELL`, in its order */
  readonly #spell: readonly (readonly [number, number])[];
  readonly #bye: readonly [number, number];
  readonly #rest: [number, number];
  readonly #lens: {x: number; y: number};
  readonly #random = new SeededRandom(17);

  constructor(layout: RoomJson) {
    if (layout.heads.length !== TURNS.length) {
      throw new Error(`new SeanceClock(): room.json has ${layout.heads.length} heads, and the séance turns ${TURNS.length}`);
    }
    // SeanceRoom lights the heads from the middle of the candles on the table: without a candle that middle is NaN
    if (layout.candles.length === 0) {
      throw new Error('new SeanceClock(): room.json has no candles, and the heads are lit from their middle');
    }
    const markOf = (name: string): readonly [number, number] => {
      const mark = layout.board.marks[name];
      if (!mark) throw new Error(`new SeanceClock(): the board of room.json has no mark ${JSON.stringify(name)}`);
      return mark;
    };
    this.#spell = SPELL.map(markOf);
    this.#bye = markOf('GOOD BYE');
    // one flicker per lamp, the candles first and then the stands: the order SeanceRoom lights them in
    const lamps = layout.candles.length + layout.stands.length;
    for (let i = 0; i < lamps; i++) this.flicker.push(uniform(1));
    this.#rest = [layout.board.x, layout.board.y - 4];
    this.#lens = layout.lens;
    // the room starts as the planchette reaches its last letters: something happens at once
    this.round = 12;
    this.time.value = 12;
  }

  random(): number {
    return this.#random.next();
  }

  update(dt: number): void {
    const t = (this.time.value += dt);
    this.round = (this.round + dt) % ROUND;
    const r = this.round;

    // the candles gutter while the heads stare
    const gutter = r > 31 && r < 35.5 ? Math.sin(((r - 31) / 4.5) * Math.PI) : 0;
    let sum = 0;
    for (let i = 0; i < this.flicker.length; i++) {
      const k = i * 1.7;
      const f =
        0.86 +
        0.07 * Math.sin(t * 9.1 + k) +
        0.05 * Math.sin(t * 23.3 + k * 2.3) +
        0.04 * Math.sin(t * 4.1 + k * 0.7) -
        gutter * (0.35 + 0.15 * Math.sin(t * 31 + k));
      this.flicker[i]!.value = f;
      sum += f;
    }
    this.glow.value = sum / Math.max(1, this.flicker.length);

    for (let i = 0; i < TURNS.length; i++) {
      const turn = TURNS[i]!;
      const toWindow = ease((r - turn.start) / turn.take);
      const back = ease((r - TURN_BACK - i * 0.4) / 2.6);
      this.turn[i] = toWindow * (1 - back);
    }

    this.ecto.value = ease((r - SPELL_END + 2) / 8) * (1 - ease((r - 33) / 6));

    this.#movePlanchette(r, t);
  }

  #movePlanchette(r: number, t: number): void {
    let x: number;
    let y: number;
    if (r < SPELL_START || r >= TURN_BACK + 4) {
      x = this.#rest[0];
      y = this.#rest[1];
    } else if (r < SPELL_END) {
      const step = Math.floor((r - SPELL_START) / SPELL_STEP);
      const f = (r - SPELL_START) / SPELL_STEP - step;
      const from = step === 0 ? this.#rest : this.#spell[step - 1]!;
      const to = this.#spell[step]!;
      // it glides in the first part of the step and rests on its letter in the second
      const k = ease(f / 0.55);
      // the second E: the planchette circles off its letter and back
      const loop = step > 0 && SPELL[step] === SPELL[step - 1] ? Math.sin(k * Math.PI) * 9 : 0;
      x = from[0] + (to[0] - from[0]) * k + loop * 0.6;
      y = from[1] + (to[1] - from[1]) * k + loop;
    } else if (r < TURN_BACK) {
      // it stays on the last letter while they look at you
      const last = this.#spell[SPELL.length - 1]!;
      x = last[0];
      y = last[1];
    } else {
      const k = ease((r - TURN_BACK) / 3);
      const from = this.#spell[SPELL.length - 1]!;
      const bye = this.#bye;
      const to = k < 0.5 ? bye : this.#rest;
      const kk = k < 0.5 ? k * 2 : (k - 0.5) * 2;
      const start = k < 0.5 ? from : bye;
      x = start[0] + (to[0] - start[0]) * ease(kk);
      y = start[1] + (to[1] - start[1]) * ease(kk);
    }
    // the sprite's middle, with its lens over the mark, and a tremor nobody's fingers make
    this.planchetteX = x - this.#lens.x + Math.sin(t * 7.3) * 0.25;
    this.planchetteY = y - this.#lens.y + Math.sin(t * 5.9) * 0.25;
    this.planchetteRot = Math.sin(t * 0.7) * 0.06 + (x - this.#rest[0]) * -0.0018;
  }
}
