import {
  Anchor,
  AnimatedFrames,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  Flash,
  Flip,
  InstancePosition,
  QuadBase,
  QuadSize,
  type SpriteOf,
  type TextureAtlasFrame,
  TextureColor,
} from '@spearwolf/twopoint5d';
import type {Sheet} from './assets';
import type {SpritesOf} from './spritesOf';
import {type Box, emptyBox, frameBox, frontOf, heldFrameWindow, placeBox} from './hitBoxes';

/**
 * The kung-fu fighter: the frames come out of the animsMap (`AnimatedFrames`), `Flip` turns him
 * to face where he walks, `Anchor` keeps his feet on his position whatever the trimmed frame
 * measures, and `Flash` lights him up when a club lands.
 */
export const FighterKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Anchor, AnimatedFrames, TextureColor, Flip, Flash],
});

type FighterSprite = SpriteOf<typeof FighterKind>;

/** What the keyboard or the autoplay asks of the fighter this frame. */
export interface FighterInput {
  /** -1 walks left, 1 walks right, 0 stands. */
  move: number;
  /** Pressed since the last frame. */
  kick: boolean;
  flyingKick: boolean;
}

type Strike = 'kick' | 'flying-kick';
type Action = 'idle' | 'walk' | Strike | 'hit';

const WALK_SPEED = 72;
// the flying kick carries him forward between the take-off and the landing frames
const FLY_SPEED = 80;
const FLY_TAKE_OFF = 0.1;
const FLY_LANDING = 0.14;
// a hit pushes him back, and the flash fades within
const KNOCK_BACK = 60;
const FLASH_TIME = 0.3;

export class Fighter {
  readonly sprites: SpritesOf<typeof FighterKind>;
  readonly sprite: FighterSprite;

  x = 0;
  /** 1 faces right — the way the sheet draws him —, -1 left. */
  dir = 1;
  action: Action = 'idle';
  /** Off leaves him facing right — he walks left backwards. */
  flip = true;

  #sheet: Sheet;
  #anim = '';
  #actionStart = 0;
  #actionEnds = 0;
  #hurtAt = Number.NEGATIVE_INFINITY;
  #flipped = false;
  #idle: TextureAtlasFrame;

  // the reach of each strike is the part of its held key frame in front of his feet: the pixels
  // of the extended leg, read from the sheet
  #body: Box;
  #strikes: Record<Strike, {reach: Box; window: [number, number]}>;
  #bodyBox = emptyBox();
  #strikeBox = emptyBox();

  constructor(sheet: Sheet) {
    this.#sheet = sheet;
    this.sprites = new FeatureSprites(FighterKind, {
      capacity: 1,
      textures: {colorMap: sheet.colorMap, animsMap: sheet.animsMap},
      uniforms: {time: 0},
    });
    this.sprite = this.sprites.createSprite()!;

    // the quad stands for the untrimmed 64 × 64 canvas, the trim shift fits each frame into it
    const idle = sheet.frame('fighter 0.aseprite');
    this.#idle = idle;
    const {w, h} = idle.data!.sourceSize!;
    this.sprite.setSize(w, h);
    // the slice "pivot" marks the pixel under his feet: the anchor (0.5, 1) of the canvas
    this.sprite.setAnchorFromPivot(idle);

    this.#body = frameBox(idle);
    this.#strikes = {
      kick: {reach: frontOf(frameBox(sheet.frame('fighter 12.aseprite'))), window: heldFrameWindow(sheet.anim('kick'))},
      'flying-kick': {
        reach: frontOf(frameBox(sheet.frame('fighter 18.aseprite'))),
        window: heldFrameWindow(sheet.anim('flying-kick')),
      },
    };
  }

  /**
   * On, the pivot of the sheet stands on his position: his feet. Off, the middle of the canvas does,
   * the default of `Anchor` — and he sinks into the floor up to his belt.
   */
  set anchorAtPivot(on: boolean) {
    if (on) this.sprite.setAnchorFromPivot(this.#idle);
    else this.sprite.setAnchor(0.5, 0.5);
    // `anchor` is static: mark the change
    this.sprites.spritePool?.touchVO(this.sprite, 'anchor');
  }

  /** Where his body is, in the world: what a club has to reach. */
  get bodyBox(): Box {
    return placeBox(this.#body, this.x, 0, this.dir, this.#bodyBox);
  }

  /** Where his strike reaches while its held key frame is on screen, else `undefined`. */
  strikeBox(now: number): Box | undefined {
    if (this.action !== 'kick' && this.action !== 'flying-kick') return undefined;
    const {reach, window} = this.#strikes[this.action];
    const t = now - this.#actionStart;
    if (t < window[0] || t >= window[1]) return undefined;
    return placeBox(reach, this.x, 0, this.dir, this.#strikeBox);
  }

  get isStriking(): boolean {
    return this.action === 'kick' || this.action === 'flying-kick';
  }

  /** A club landed: the hit animation, a flash and a step back. A strike in progress wins. */
  hurt(now: number, fromDir: number): boolean {
    if (this.isStriking || this.action === 'hit') return false;
    this.dir = -fromDir;
    this.#hurtAt = now;
    this.#start('hit', now);
    return true;
  }

  update(now: number, dt: number, input: FighterInput, minX: number, maxX: number): void {
    // a one-shot runs to its end, then he is free again
    if (this.action !== 'idle' && this.action !== 'walk' && now >= this.#actionEnds) this.action = 'idle';

    if (this.action === 'idle' || this.action === 'walk') {
      if (input.flyingKick) {
        this.#start('flying-kick', now);
      } else if (input.kick) {
        this.#start('kick', now);
      } else if (input.move !== 0) {
        this.dir = Math.sign(input.move);
        this.x += this.dir * WALK_SPEED * dt;
        this.#loop('walk', now);
      } else {
        this.#loop('idle', now);
      }
    }

    const t = now - this.#actionStart;
    if (this.action === 'flying-kick' && t > FLY_TAKE_OFF && t < this.#actionEnds - this.#actionStart - FLY_LANDING) {
      this.x += this.dir * FLY_SPEED * dt;
    } else if (this.action === 'hit') {
      this.x -= this.dir * KNOCK_BACK * dt;
    }
    this.x = Math.min(maxX, Math.max(minX, this.x));

    const {sprite} = this;
    // whole pixels: the art stays on the pixel grid of the camera
    sprite.setPosition(Math.round(this.x), 0);

    // `flip` is a static attribute: a turn is marked for the next upload
    const flipped = this.flip && this.dir < 0;
    if (flipped !== this.#flipped) {
      this.#flipped = flipped;
      sprite.flipX = flipped ? 1 : 0;
      this.sprites.spritePool?.touchVO(sprite, 'flip');
    }

    // a red-white flash that fades out — `flash` is dynamic and uploads every frame
    sprite.setFlash(1, 0.85, 0.8, Math.max(0, 1 - (now - this.#hurtAt) / FLASH_TIME));

    this.sprites.setUniform('time', now);
    this.sprites.update();
  }

  // a one-shot from now on: `animOffset = -now` starts it at its first frame, and after
  // `cycleDuration` it holds its last until another takes its place
  #start(action: Strike | 'hit', now: number): void {
    this.action = action;
    this.#actionStart = now;
    this.#actionEnds = now + this.#sheet.anim(action).cycleDuration;
    this.#play(action, now);
  }

  // a loop or a ping-pong goes on as it is; only a change of the animation restarts it
  #loop(action: 'idle' | 'walk', now: number): void {
    this.action = action;
    if (this.#anim !== action) this.#play(action, now);
  }

  #play(name: string, now: number): void {
    this.#anim = name;
    this.sprite.animId = this.#sheet.anim(name).id;
    this.sprite.animOffset = -now;
    // `anim` is static: mark the change for the next update()
    this.sprites.spritePool?.touchVO(this.sprite, 'anim');
  }

  dispose(): void {
    this.sprites.dispose();
  }
}
