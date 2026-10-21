/**
 * A small Verlet simulation of points and sticks — the physics of the rope bridge. It belongs to the
 * demo, not to the library: the segment sprites draw whatever a simulation writes, and this is one.
 *
 * Every point keeps its position and the one of the step before; the difference is its velocity.
 * A step moves each free point on by that velocity and gravity, then pulls the sticks back to their
 * rest lengths a few times over. A point with an inverse mass of 0 is pinned: the sticks pull on it
 * and it does not move. Heavy points — a lantern, a dropped weight — have a small inverse mass.
 */
export class VerletRopes {
  /** The downward acceleration, in units per second squared. */
  gravity = 420;
  /** How much of its velocity a point keeps from one step to the next. */
  damping = 0.996;
  /** How often a step pulls every stick back to its length: more is stiffer. */
  iterations = 14;

  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly #px: Float64Array;
  readonly #py: Float64Array;
  readonly #invMass: Float64Array;
  #pointCount = 0;

  readonly #stickA: Uint16Array;
  readonly #stickB: Uint16Array;
  readonly #stickRest: Float64Array;
  #stickCount = 0;

  // the point the pointer holds, and where it holds it
  #held = -1;
  #heldX = 0;
  #heldY = 0;
  #heldInvMass = 0;

  // round weights that land on the sticks of a deck
  readonly #weights: {point: number; radius: number}[] = [];
  #deckFirst = 0;
  #deckCount = 0;

  #accumulator = 0;

  /** The length of one step, in seconds: a fixed step keeps the sticks stable at any frame rate. */
  static readonly STEP = 1 / 120;

  constructor(maxPoints: number, maxSticks: number) {
    this.x = new Float64Array(maxPoints);
    this.y = new Float64Array(maxPoints);
    this.#px = new Float64Array(maxPoints);
    this.#py = new Float64Array(maxPoints);
    this.#invMass = new Float64Array(maxPoints);
    this.#stickA = new Uint16Array(maxSticks);
    this.#stickB = new Uint16Array(maxSticks);
    this.#stickRest = new Float64Array(maxSticks);
  }

  get pointCount(): number {
    return this.#pointCount;
  }

  /** Adds a point at rest; an `invMass` of 0 pins it. Answers its index. */
  addPoint(x: number, y: number, invMass = 1): number {
    const i = this.#pointCount++;
    this.x[i] = this.#px[i] = x;
    this.y[i] = this.#py[i] = y;
    this.#invMass[i] = invMass;
    return i;
  }

  /** Adds a stick between two points; without `rest` it keeps the distance they have now. */
  addStick(a: number, b: number, rest = Math.hypot(this.x[b]! - this.x[a]!, this.y[b]! - this.y[a]!)): number {
    const i = this.#stickCount++;
    this.#stickA[i] = a;
    this.#stickB[i] = b;
    this.#stickRest[i] = rest;
    return i;
  }

  /** The sticks `first` to `first + count − 1` are the deck that weights land on. */
  setDeck(first: number, count: number): void {
    this.#deckFirst = first;
    this.#deckCount = count;
  }

  /** A point that collides with the deck as a disc of `radius`. */
  addWeight(point: number, radius: number): void {
    this.#weights.push({point, radius});
  }

  removeWeight(point: number): void {
    const i = this.#weights.findIndex((weight) => weight.point === point);
    if (i >= 0) this.#weights.splice(i, 1);
  }

  isPinned(i: number): boolean {
    return this.#invMass[i] === 0 && i !== this.#held;
  }

  /** Puts a point somewhere else, at rest there. */
  teleport(i: number, x: number, y: number): void {
    this.x[i] = this.#px[i] = x;
    this.y[i] = this.#py[i] = y;
  }

  setInvMass(i: number, invMass: number): void {
    if (i === this.#held) this.#heldInvMass = invMass;
    else this.#invMass[i] = invMass;
  }

  /** Adds `(dx, dy)` to the velocity of a point, in units per second. */
  push(i: number, dx: number, dy: number): void {
    this.#px[i]! -= dx * VerletRopes.STEP;
    this.#py[i]! -= dy * VerletRopes.STEP;
  }

  /** The free point nearest to `(x, y)` within `radius`, or −1. */
  pick(x: number, y: number, radius: number): number {
    let best = -1;
    let bestDistance = radius * radius;
    for (let i = 0; i < this.#pointCount; i++) {
      if (this.#invMass[i] === 0) continue;
      const dx = this.x[i]! - x;
      const dy = this.y[i]! - y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  /** The pointer takes hold of a point: it follows `hold()` until `release()`. */
  grab(i: number): void {
    this.release();
    this.#held = i;
    this.#heldInvMass = this.#invMass[i]!;
    this.#invMass[i] = 0;
    this.#heldX = this.x[i]!;
    this.#heldY = this.y[i]!;
  }

  hold(x: number, y: number): void {
    this.#heldX = x;
    this.#heldY = y;
  }

  release(): void {
    if (this.#held < 0) return;
    this.#invMass[this.#held] = this.#heldInvMass;
    this.#held = -1;
  }

  /** Runs the fixed steps that fit into `deltaTime`, at most eight of them. */
  update(deltaTime: number): void {
    this.#accumulator = Math.min(this.#accumulator + deltaTime, VerletRopes.STEP * 8);
    while (this.#accumulator >= VerletRopes.STEP) {
      this.#accumulator -= VerletRopes.STEP;
      this.step(VerletRopes.STEP);
    }
  }

  step(dt: number): void {
    const {x, y} = this;
    const px = this.#px;
    const py = this.#py;
    const invMass = this.#invMass;
    const fall = this.gravity * dt * dt;

    for (let i = 0; i < this.#pointCount; i++) {
      if (invMass[i] === 0) continue;
      const vx = (x[i]! - px[i]!) * this.damping;
      const vy = (y[i]! - py[i]!) * this.damping;
      px[i] = x[i]!;
      py[i] = y[i]!;
      x[i]! += vx;
      y[i]! += vy - fall;
    }

    if (this.#held >= 0) {
      // the held point moves with the pointer, and keeps the velocity of that move when it is let go
      const i = this.#held;
      px[i] = x[i]!;
      py[i] = y[i]!;
      x[i] = this.#heldX;
      y[i] = this.#heldY;
    }

    for (let k = 0; k < this.iterations; k++) {
      this.#relaxSticks();
      this.#collideWeights();
    }
  }

  #relaxSticks(): void {
    const {x, y} = this;
    const invMass = this.#invMass;
    for (let s = 0; s < this.#stickCount; s++) {
      const a = this.#stickA[s]!;
      const b = this.#stickB[s]!;
      const wa = invMass[a]!;
      const wb = invMass[b]!;
      const w = wa + wb;
      if (w === 0) continue;
      const dx = x[b]! - x[a]!;
      const dy = y[b]! - y[a]!;
      const length = Math.hypot(dx, dy);
      if (length < 1e-9) continue;
      const pull = (length - this.#stickRest[s]!) / (length * w);
      x[a]! += dx * pull * wa;
      y[a]! += dy * pull * wa;
      x[b]! -= dx * pull * wb;
      y[b]! -= dy * pull * wb;
    }
  }

  // a weight is a disc that the deck sticks push out of themselves, the push shared by mass:
  // the weight and the two ends of the stick, each end by how near the contact lies to it
  #collideWeights(): void {
    const {x, y} = this;
    const invMass = this.#invMass;
    for (const {point: p, radius} of this.#weights) {
      const wp = invMass[p]!;
      for (let s = this.#deckFirst; s < this.#deckFirst + this.#deckCount; s++) {
        const a = this.#stickA[s]!;
        const b = this.#stickB[s]!;
        const ex = x[b]! - x[a]!;
        const ey = y[b]! - y[a]!;
        const lengthSq = ex * ex + ey * ey;
        if (lengthSq < 1e-9) continue;
        const u = Math.min(1, Math.max(0, ((x[p]! - x[a]!) * ex + (y[p]! - y[a]!) * ey) / lengthSq));
        const nx = x[p]! - (x[a]! + ex * u);
        const ny = y[p]! - (y[a]! + ey * u);
        const distance = Math.hypot(nx, ny);
        if (distance >= radius || distance < 1e-9) continue;
        const wa = invMass[a]! * (1 - u);
        const wb = invMass[b]! * u;
        const w = wp + wa * (1 - u) + wb * u;
        if (w === 0) continue;
        const lambda = (radius - distance) / (distance * w);
        x[p]! += nx * lambda * wp;
        y[p]! += ny * lambda * wp;
        x[a]! -= nx * lambda * wa;
        y[a]! -= ny * lambda * wa;
        x[b]! -= nx * lambda * wb;
        y[b]! -= ny * lambda * wb;
      }
    }
  }
}
