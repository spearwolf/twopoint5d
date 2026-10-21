import {
  Anchor,
  AnimatedFrames,
  defineSprite,
  Fade,
  FeatureSprites,
  FlatPlacement,
  Flash,
  Flip,
  InstancePosition,
  PaletteSwap,
  QuadBase,
  QuadSize,
  type SpriteOf,
  type TextureAtlasFrame,
  TextureColor,
  type FeatureSpritesOf,
} from '@spearwolf/twopoint5d';
import type {Texture} from 'three/webgpu';
import type {Sheet} from './assets';
import type {Fighter} from './Fighter';
import {type Box, emptyBox, frameBox, frontOf, heldFrameWindow, overlaps, placeBox} from './hitBoxes';

/**
 * The goblins: one sheet in olive, drawn in red, blue and green by `PaletteSwap` — each goblin
 * names its row of `goblin-palette.png` —, turned by `Flip`, standing on the pivot of the sheet by
 * `Anchor`. A kick flashes them white (`Flash`), the dead fade out and the new ones fade in
 * (`Fade`).
 */
export const GoblinKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Anchor, AnimatedFrames, TextureColor, Flip, PaletteSwap, Fade, Flash],
});

type GoblinSprite = SpriteOf<typeof GoblinKind>;

type State = 'walk' | 'attack' | 'hit' | 'die' | 'gone';

interface Goblin {
  sprite: GoblinSprite;
  state: State;
  x: number;
  dir: number;
  speed: number;
  /** The patrol: it walks between these two and turns. */
  minX: number;
  maxX: number;
  /** The palette row, 1 red, 2 blue, 3 green. */
  row: number;
  stateStart: number;
  stateEnds: number;
  /** The fighter was hit by this attack already. */
  landed: boolean;
  nextAttack: number;
  flashAt: number;
  /** A fade from `from` to `to`, begun at `start`: out when it died, in when it came. */
  fade: {from: number; to: number; start: number};
  anim: string;
}

const WALK_SPEED = [22, 34] as const;
// it sees the fighter this far off and walks his way
const SIGHT = 110;
const ATTACK_COOLDOWN = 1.4;
// the kick throws it back while it reels
const THROWN_BACK = 90;
const FLASH_TIME = 0.25;
// the corpse lies this long on the last frame of "die", then fades
const LIE_STILL = 0.6;
const FADE_TIME = 0.7;
// gone this long before a new one fades in
const RESPAWN_AFTER = 1.2;

export interface GoblinsOptions {
  count: number;
  minX: number;
  maxX: number;
  random: () => number;
}

export class Goblins {
  readonly sprites: FeatureSpritesOf<typeof GoblinKind>;
  readonly goblins: Goblin[] = [];

  /** Off draws every goblin in the olive of the sheet, row 0 of the palette. */
  paletteSwap = true;
  /** Off leaves every goblin facing right — they walk left backwards. */
  flip = true;

  #sheet: Sheet;
  #random: () => number;
  #minX: number;
  #maxX: number;
  #body: Box;
  #club: Box;
  #attackWindow: [number, number];
  #box = emptyBox();
  #fighterBox = emptyBox();
  #walkFrame: TextureAtlasFrame;

  constructor(sheet: Sheet, palette: Texture, {count, minX, maxX, random}: GoblinsOptions) {
    this.#sheet = sheet;
    this.#random = random;
    this.#minX = minX;
    this.#maxX = maxX;

    this.sprites = new FeatureSprites(GoblinKind, {
      capacity: count,
      textures: {colorMap: sheet.colorMap, animsMap: sheet.animsMap, palette},
      uniforms: {time: 0},
      // a fade between 0 and 1 blends
      transparent: true,
      // the goblins turn every few seconds, and the flip of every one is written each frame
      attributeUsage: {dynamic: ['flip']},
    });

    const walk = sheet.frame('goblin 0.aseprite');
    this.#walkFrame = walk;
    this.#body = frameBox(walk);
    // the held strike of the attack (frame 6): its front is what the club reaches
    this.#club = frontOf(frameBox(sheet.frame('goblin 6.aseprite')));
    this.#attackWindow = heldFrameWindow(sheet.anim('attack'));

    const {w, h} = walk.data!.sourceSize!;
    for (let i = 0; i < count; i++) {
      const sprite = this.sprites.createSprite()!;
      sprite.setSize(w, h);
      sprite.setAnchorFromPivot(walk);
      const span = (maxX - minX) / count;
      const goblin: Goblin = {
        sprite,
        state: 'walk',
        x: 0,
        dir: 1,
        speed: 0,
        minX: 0,
        maxX: 0,
        row: 1 + (i % 3),
        stateStart: 0,
        stateEnds: 0,
        landed: false,
        nextAttack: 0,
        flashAt: Number.NEGATIVE_INFINITY,
        fade: {from: 1, to: 1, start: 0},
        anim: '',
      };
      this.#patrol(goblin, minX + span * (i + 0.5), 0);
      this.goblins.push(goblin);
    }
  }

  /** On, every goblin stands on the pivot of the sheet; off, on the middle of its canvas. */
  set anchorAtPivot(on: boolean) {
    for (const {sprite} of this.goblins) {
      if (on) sprite.setAnchorFromPivot(this.#walkFrame);
      else sprite.setAnchor(0.5, 0.5);
    }
    // `anchor` is static: one mark for every sprite of the mesh
    this.sprites.geometry?.touch('anchor');
  }

  /** The goblins a fighter can fight: walking or swinging their clubs. */
  isAlive(goblin: Goblin): boolean {
    return goblin.state === 'walk' || goblin.state === 'attack';
  }

  /** A strike of the fighter: every living goblin it reaches is hit. Answers how many. */
  strike(box: Box, fromDir: number, now: number): number {
    let hits = 0;
    for (const goblin of this.goblins) {
      if (!this.isAlive(goblin) || !overlaps(box, placeBox(this.#body, goblin.x, 0, goblin.dir, this.#box))) continue;
      hits++;
      goblin.dir = -fromDir;
      goblin.flashAt = now;
      this.#start(goblin, 'hit', now);
    }
    return hits;
  }

  update(now: number, dt: number, fighter: Fighter): void {
    const fighterBox = this.#fighterBox;
    Object.assign(fighterBox, fighter.bodyBox);

    for (const goblin of this.goblins) {
      const {sprite} = goblin;
      const t = now - goblin.stateStart;

      switch (goblin.state) {
        case 'walk': {
          const dx = fighter.x - goblin.x;
          if (Math.abs(dx) < SIGHT && fighter.action !== 'hit') {
            // face the fighter and close in; swing once he is within reach of the club
            goblin.dir = Math.sign(dx) || goblin.dir;
            const inReach = overlaps(placeBox(this.#club, goblin.x, 0, goblin.dir, this.#box), fighterBox);
            if (inReach && now >= goblin.nextAttack) {
              goblin.landed = false;
              this.#start(goblin, 'attack', now);
            } else if (!inReach) {
              goblin.x += goblin.dir * goblin.speed * dt;
            }
          } else {
            goblin.x += goblin.dir * goblin.speed * dt;
            if (goblin.x < goblin.minX) goblin.dir = 1;
            if (goblin.x > goblin.maxX) goblin.dir = -1;
          }
          this.#loop(goblin, 'walk', now);
          break;
        }
        case 'attack': {
          const [from, to] = this.#attackWindow;
          if (!goblin.landed && t >= from && t < to) {
            if (overlaps(placeBox(this.#club, goblin.x, 0, goblin.dir, this.#box), fighterBox)) {
              goblin.landed = fighter.hurt(now, goblin.dir);
            }
          }
          if (now >= goblin.stateEnds) {
            goblin.nextAttack = now + ATTACK_COOLDOWN;
            goblin.state = 'walk';
          }
          break;
        }
        case 'hit':
          goblin.x -= goblin.dir * THROWN_BACK * dt * (1 - t / (goblin.stateEnds - goblin.stateStart));
          // the hit plays once, then the fall: two one-shots in a row
          if (now >= goblin.stateEnds) this.#start(goblin, 'die', now);
          break;
        case 'die':
          // "die" holds its last frame — the goblin on its back — for a moment, then fades out
          if (now >= goblin.stateEnds + LIE_STILL) {
            goblin.fade = {from: 1, to: 0, start: now};
            goblin.state = 'gone';
            goblin.stateStart = now;
          }
          break;
        case 'gone':
          if (t >= FADE_TIME + RESPAWN_AFTER) this.#respawn(goblin, now, fighter.x);
          break;
      }
      goblin.x = Math.min(this.#maxX, Math.max(this.#minX, goblin.x));

      sprite.setPosition(Math.round(goblin.x), 0);
      sprite.flipX = this.flip && goblin.dir < 0 ? 1 : 0;
      sprite.setFlash(1, 1, 1, Math.max(0, 1 - (now - goblin.flashAt) / FLASH_TIME));
      // `fade` is dynamic, as `flash` is: both upload with every update()
      const {from, to, start} = goblin.fade;
      sprite.fade = from + (to - from) * Math.min(1, (now - start) / FADE_TIME);

      // `paletteRow` is static: a write marks the sprite for the next upload
      const row = this.paletteSwap ? goblin.row : 0;
      if (sprite.paletteRow !== row) {
        sprite.paletteRow = row;
        this.sprites.spritePool?.touchVO(sprite, 'paletteRow');
      }
    }

    this.sprites.setUniform('time', now);
    this.sprites.update();
  }

  // a new goblin in another colour, away from the fighter, fading in where it walks
  #respawn(goblin: Goblin, now: number, fighterX: number): void {
    let x = fighterX;
    for (let tries = 0; tries < 8 && Math.abs(x - fighterX) < 140; tries++) {
      x = this.#minX + 40 + this.#random() * (this.#maxX - this.#minX - 80);
    }
    goblin.row = 1 + ((goblin.row + Math.floor(this.#random() * 2)) % 3);
    goblin.flashAt = Number.NEGATIVE_INFINITY;
    goblin.fade = {from: 0, to: 1, start: now};
    goblin.nextAttack = now + FADE_TIME + ATTACK_COOLDOWN;
    this.#patrol(goblin, x, now);
  }

  #patrol(goblin: Goblin, x: number, now: number): void {
    const range = 50 + this.#random() * 70;
    goblin.x = x;
    goblin.minX = x - range;
    goblin.maxX = x + range;
    goblin.dir = this.#random() < 0.5 ? -1 : 1;
    goblin.speed = WALK_SPEED[0] + this.#random() * (WALK_SPEED[1] - WALK_SPEED[0]);
    goblin.state = 'walk';
    goblin.stateStart = now;
    goblin.anim = '';
    // the walks of the goblins run out of step
    this.#play(goblin, 'walk', now - this.#random());
  }

  // a one-shot from now on, held on its last frame after `cycleDuration`
  #start(goblin: Goblin, state: 'attack' | 'hit' | 'die', now: number): void {
    goblin.state = state;
    goblin.stateStart = now;
    goblin.stateEnds = now + this.#sheet.anim(state).cycleDuration;
    this.#play(goblin, state, now);
  }

  #loop(goblin: Goblin, name: 'walk', now: number): void {
    if (goblin.anim !== name) this.#play(goblin, name, now);
  }

  #play(goblin: Goblin, name: string, now: number): void {
    goblin.anim = name;
    goblin.sprite.animId = this.#sheet.anim(name).id;
    goblin.sprite.animOffset = -now;
    this.sprites.spritePool?.touchVO(goblin.sprite, 'anim');
  }

  dispose(): void {
    this.sprites.dispose();
  }
}
