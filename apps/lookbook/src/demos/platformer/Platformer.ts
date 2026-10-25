import {OrthographicProjection} from '@spearwolf/twopoint5d';
import {OrthographicCamera, Scene} from 'three/webgpu';
import type {PlatformerAssets} from './assets';
import {Backdrop} from './Backdrop';
import {Fighter, type FighterInput} from './Fighter';
import {Goblins} from './Goblins';

// the arena, in art pixels; the fighter stays inside the crates at both ends
const ARENA_MIN_X = -640;
const ARENA_MAX_X = 640;
const WALL = 56;
// the camera shows about this many art pixels from top to bottom, scaled up by a whole number
const VIEW_HEIGHT = 248;
// how far below the floor top (y = 0) the bottom of the screen lies
const BELOW_FLOOR = 34;
// the bottom edge of the parallax layers: the dark ground of the machine city just shows above the floor
const LAYER_BOTTOM = -14;
// the fighter looks ahead: the camera leads him by this much, and follows with this rate
const LOOK_AHEAD = 40;
const FOLLOW = 4;
// the fighter is left to the autoplay after this many seconds without a key
const AUTOPLAY_AFTER = 6;

/** A small seeded random number generator, so that every load plays the same way. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The kung-fu platformer: the backdrop, the fighter and the goblins in one scene, an orthographic
 * camera that draws one art pixel as a whole number of device pixels and follows the fighter, the
 * keyboard, and an autoplay that fights when nobody does.
 */
export class Platformer {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera();
  readonly fighter: Fighter;
  readonly goblins: Goblins;
  readonly backdrop: Backdrop;

  /** Whether the autoplay steers the fighter: from the start, and again when the keys rest. */
  autoplay = true;
  /** Hears the first strike that reaches a goblin — the preview image waits for it. */
  onFirstHit?: () => void;

  #random = seededRandom(70);
  #keys = new Set<string>();
  #pressed = new Set<string>();
  #lastKeyAt = Number.NEGATIVE_INFINITY;
  #input: FighterInput = {move: 0, kick: false, flyingKick: false};
  #cameraX = 0;
  #viewWidth = 0;
  // the smallest whole number of device pixels per art pixel at which at most VIEW_HEIGHT art
  // pixels fill the height, with a frustum whose edges lie on whole art pixels
  readonly #projection = new OrthographicProjection('xy|bottom-left', {
    fit: 'cover',
    height: VIEW_HEIGHT,
    pixelSnap: true,
    distanceToProjectionPlane: 100,
    near: 1,
    far: 200,
  });
  #hits = 0;
  // the autoplay pauses between its moves, as a fighter on guard does
  #autoplayWaitUntil = 0;

  constructor(assets: PlatformerAssets) {
    this.backdrop = new Backdrop({...assets.layers, tiles: assets.tiles}, ARENA_MIN_X, ARENA_MAX_X, LAYER_BOTTOM);
    this.scene.add(this.backdrop);

    this.goblins = new Goblins(assets.goblin, assets.goblinPalette, {
      count: 6,
      minX: ARENA_MIN_X + WALL,
      maxX: ARENA_MAX_X - WALL,
      random: this.#random,
    });
    this.goblins.sprites.position.z = 0;
    this.scene.add(this.goblins.sprites);

    this.fighter = new Fighter(assets.fighter);
    this.fighter.x = 0;
    // in front of the goblins: they are transparent and are drawn after him
    this.fighter.sprites.position.z = 1;
    this.scene.add(this.fighter.sprites);

    this.#cameraX = this.fighter.x;
  }

  /** The keys of the page: ←/→ walk, ↑ or space a flying kick, K a kick. */
  readonly onKeyDown = (event: KeyboardEvent) => {
    const key = keyOf(event);
    if (key === undefined) return;
    event.preventDefault();
    if (!this.#keys.has(key)) this.#pressed.add(key);
    this.#keys.add(key);
    this.#lastKeyAt = performance.now() / 1000;
    this.autoplay = false;
  };

  readonly onKeyUp = (event: KeyboardEvent) => {
    const key = keyOf(event);
    if (key !== undefined) this.#keys.delete(key);
  };

  /** Fits the view to a display of `width` × `height` CSS pixels drawn at `pixelRatio`. */
  resize(width: number, height: number, pixelRatio: number): void {
    this.#projection.updateViewRect(width, height, pixelRatio);
    this.#projection.updateCamera(this.camera);
    const view = this.#projection.getViewRect();
    this.#viewWidth = view.width;
    // the bottom edge of the frustum lies Math.floor(height / 2) art pixels below the camera: a
    // camera that many pixels above it puts the floor BELOW_FLOOR art pixels above that edge
    this.camera.position.y = Math.floor(view.height / 2) - BELOW_FLOOR;
  }

  /** Both kinds stand on the pivot of their sheets, or — to see what `Anchor` does — on their middles. */
  set anchorAtPivot(on: boolean) {
    this.fighter.anchorAtPivot = on;
    this.goblins.anchorAtPivot = on;
  }

  update(now: number, dt: number): void {
    if (!this.autoplay && this.#keys.size === 0 && performance.now() / 1000 - this.#lastKeyAt > AUTOPLAY_AFTER) {
      this.autoplay = true;
    }
    const input = this.autoplay ? this.#autoplayInput(now) : this.#keyboardInput();

    const {fighter, goblins} = this;
    fighter.update(now, dt, input, ARENA_MIN_X + WALL, ARENA_MAX_X - WALL);

    const strike = fighter.strikeBox(now);
    if (strike !== undefined && goblins.strike(strike, fighter.dir, now) > 0 && this.#hits++ === 0) {
      this.onFirstHit?.();
    }
    goblins.update(now, dt, fighter);

    // the camera leads the fighter and stops at the walls of the arena
    const halfView = this.#viewWidth / 2;
    const target = Math.min(ARENA_MAX_X - halfView, Math.max(ARENA_MIN_X + halfView, fighter.x + fighter.dir * LOOK_AHEAD));
    this.#cameraX += (target - this.#cameraX) * Math.min(1, dt * FOLLOW);
    if (halfView * 2 >= ARENA_MAX_X - ARENA_MIN_X) this.#cameraX = (ARENA_MIN_X + ARENA_MAX_X) / 2;
    // whole art pixels: nothing shimmers as it scrolls
    const cameraX = Math.round(this.#cameraX);
    this.camera.position.x = cameraX;
    this.backdrop.update(cameraX, this.#viewWidth);
  }

  #keyboardInput(): FighterInput {
    const input = this.#input;
    input.move = (this.#keys.has('right') ? 1 : 0) - (this.#keys.has('left') ? 1 : 0);
    input.kick = this.#pressed.has('kick');
    input.flyingKick = this.#pressed.has('jump');
    this.#pressed.clear();
    return input;
  }

  // walks up to the nearest goblin, turns to face it and kicks — a flying kick from a little
  // further off, since it carries him forward
  #autoplayInput(now: number): FighterInput {
    const input = this.#input;
    input.move = 0;
    input.kick = false;
    input.flyingKick = false;
    const {fighter, goblins} = this;
    if (now < this.#autoplayWaitUntil || fighter.action === 'hit') return input;

    let nearest: number | undefined;
    for (const goblin of goblins.goblins) {
      if (!goblins.isAlive(goblin) || goblin.sprite.fade < 1) continue;
      const dx = goblin.x - fighter.x;
      if (nearest === undefined || Math.abs(dx) < Math.abs(nearest)) nearest = dx;
    }
    if (nearest === undefined) return input;

    const distance = Math.abs(nearest);
    const facing = Math.sign(nearest) === fighter.dir;
    if (distance > 62 || !facing) {
      input.move = Math.sign(nearest);
    } else if (distance > 40) {
      input.flyingKick = true;
      this.#autoplayWaitUntil = now + 0.9 + this.#random() * 0.4;
    } else {
      input.kick = true;
      this.#autoplayWaitUntil = now + 0.7 + this.#random() * 0.4;
    }
    return input;
  }

  dispose(): void {
    this.fighter.dispose();
    this.goblins.dispose();
    this.backdrop.dispose();
  }
}

function keyOf(event: KeyboardEvent): 'left' | 'right' | 'jump' | 'kick' | undefined {
  switch (event.code) {
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    case 'ArrowUp':
    case 'Space':
    case 'KeyW':
      return 'jump';
    case 'KeyK':
      return 'kick';
    default:
      return undefined;
  }
}
