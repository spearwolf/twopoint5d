import {on} from '@spearwolf/eventize';
import {
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageResize,
  OnStageUpdateFrame,
  OrthographicProjection,
  rewriteText,
  Stage2D,
  StageRenderer,
  type StageUpdateFrameProps,
  type TexturedSprite,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {Color, RenderPipeline, type WebGPURenderer} from 'three/webgpu';
import {type StageTransitionAssets, VIEW_HEIGHT, VIEW_WIDTH} from './assets';
import {createGlowLayerBuilder, type GlowLayerBuilder} from './glowLayerBuilder';

/** The keys the level reads, written by the page. */
export interface LevelInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

const ENEMIES = 6;
const BULLETS = 48;
const PLAYER_SPEED = 260;
const BULLET_SPEED = 520;
const FIRE_INTERVAL = 0.14;
// above white: only the bullets reach the threshold of the bloom
const BULLET_TINT = new Color(0.6, 2.4, 3.2);
const HELP_COLOR = new Color('#9fb3d9');
const SCORE_COLOR = new Color('#ffd166');

interface Enemy {
  sprite: TexturedSprite;
  x: number;
  y: number;
  phase: number;
  speed: number;
}

interface Bullet {
  sprite: TexturedSprite;
  x: number;
  y: number;
  live: boolean;
}

/**
 * The game: a `StageRenderer` of two stages — the world and the HUD — with a bloom of its own. The
 * director lays the whole renderer into its stack as one layer.
 */
export class GameLevel {
  readonly renderer = new StageRenderer();
  readonly world = new Stage2D(
    new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'contain'}),
  );
  readonly hud = new Stage2D(
    new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'contain'}),
  );

  readonly #assets: StageTransitionAssets;
  readonly #input: LevelInput;
  readonly #ships: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #shots: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #text: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #player: TexturedSprite;
  readonly #enemies: Enemy[] = [];
  readonly #bullets: Bullet[] = [];
  readonly #pipeline: RenderPipeline;
  readonly #glow: GlowLayerBuilder;

  #x = 0;
  #y = -120;
  #cooldown = 0;
  #score = 0;
  #scoreGlyphs: TexturedSprite[] = [];
  #helpGlyphs: TexturedSprite[] = [];

  constructor(renderer: WebGPURenderer, assets: StageTransitionAssets, input: LevelInput) {
    this.#assets = assets;
    this.#input = input;
    this.renderer.name = 'level';
    this.world.name = 'world';
    this.hud.name = 'hud';
    this.renderer.add(this.world).add(this.hud);

    // the bloom of the level alone: the stars below and the menus on top stay as they are
    this.#pipeline = new RenderPipeline(renderer);
    this.#glow = createGlowLayerBuilder(1.1, 0.4, 1);
    this.renderer.pipeline = this.#pipeline;
    this.renderer.buildOutputNode = this.#glow;

    this.#ships = new FeatureSprites(TexturedSpriteKind, {
      capacity: 1 + ENEMIES,
      textures: {colorMap: assets.shipsTexture},
      transparent: true,
    });
    this.#shots = new FeatureSprites(TexturedSpriteKind, {
      capacity: BULLETS,
      textures: {colorMap: assets.dot},
      transparent: true,
      depthWrite: false,
    });
    this.world.scene.add(this.#shots, this.#ships);

    this.#player = this.#ships.createSprite()!;
    this.#player.setFrame(assets.ships.frame('ship-00')!);
    this.#player.setSize(58, 58);

    for (let i = 0; i < ENEMIES; i++) {
      const sprite = this.#ships.createSprite()!;
      sprite.setFrame(assets.ships.frame('ship-02')!);
      sprite.setSize(54, 51);
      sprite.rotation = Math.PI * 0.75;
      const enemy = {sprite, x: 0, y: 0, phase: Math.random() * Math.PI * 2, speed: 0};
      this.#respawn(enemy, this.#halfHeight + 40 + i * 70);
      this.#enemies.push(enemy);
    }
    for (let i = 0; i < BULLETS; i++) {
      const sprite = this.#shots.createSprite()!;
      sprite.setSize(6, 18);
      sprite.setTexCoords(0, 0, 1, 1);
      sprite.setColor(BULLET_TINT, 0);
      this.#bullets.push({sprite, x: 0, y: -1000, live: false});
    }

    this.#text = new FeatureSprites(TexturedSpriteKind, {
      capacity: 64,
      textures: {colorMap: assets.pixelPage},
      transparent: true,
    });
    this.hud.scene.add(this.#text);
    this.#writeHud();

    on(this.world, OnStageUpdateFrame, ({deltaTime}: StageUpdateFrameProps) => this.#update(deltaTime));
    // the HUD keeps to the corners of the screen, not to those of the 640×360 box
    on(this.hud, OnStageResize, () => this.#writeHud());
  }

  /**
   * The half extents of what the screen shows of the world. `contain` keeps the 640×360 box in
   * view and shows more around it: on a phone held upright far more above and below. The enemies
   * come in and leave at the edges of the screen, not at those of the box.
   */
  get #halfWidth(): number {
    return (this.world.width || VIEW_WIDTH) / 2;
  }

  get #halfHeight(): number {
    return (this.world.height || VIEW_HEIGHT) / 2;
  }

  /** A new game: the player in the middle, the score at 0, the enemies above the view. */
  reset(): void {
    this.#x = 0;
    this.#y = -120;
    this.#score = 0;
    this.#writeScore();
    this.#enemies.forEach((enemy, i) => this.#respawn(enemy, this.#halfHeight + 40 + i * 70));
    for (const bullet of this.#bullets) bullet.live = false;
    // the first picture of the level shows it as it starts
    this.#update(0);
  }

  #respawn(enemy: Enemy, y: number): void {
    enemy.x = (Math.random() - 0.5) * (this.#halfWidth * 2 - 80);
    enemy.y = y;
    enemy.speed = 50 + Math.random() * 50;
  }

  /** World units per CSS pixel of the HUD: the margins around the lookbook's bars are pixels. */
  get #unit(): number {
    return this.hud.containerHeight > 0 ? this.hud.height / this.hud.containerHeight : 1;
  }

  #writeHud(): void {
    const halfWidth = (this.hud.width || VIEW_WIDTH) / 2;
    const halfHeight = (this.hud.height || VIEW_HEIGHT) / 2;
    const unit = this.#unit;
    this.#helpGlyphs = rewriteText(this.#text, this.#helpGlyphs, this.#assets.pixelFont, 'ARROWS MOVE   ESC PAUSE   Q QUIT', {
      x: halfWidth - 16 * unit,
      // clear of the toolbar of the lookbook
      y: -halfHeight + 56 * unit,
      align: 'right',
      scale: 1,
    });
    for (const glyph of this.#helpGlyphs) glyph.setColor(HELP_COLOR);
    this.#writeScore();
  }

  #writeScore(): void {
    const unit = this.#unit;
    this.#scoreGlyphs = rewriteText(
      this.#text,
      this.#scoreGlyphs,
      this.#assets.pixelFont,
      `SCORE ${String(this.#score).padStart(6, '0')}`,
      {
        x: -(this.hud.width || VIEW_WIDTH) / 2 + 16 * unit,
        // clear of the navbar of the lookbook
        y: (this.hud.height || VIEW_HEIGHT) / 2 - 72 * unit,
        scale: 2,
      },
    );
    for (const glyph of this.#scoreGlyphs) glyph.setColor(SCORE_COLOR);
    this.#text.update();
  }

  #update(deltaTime: number): void {
    const input = this.#input;
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    const halfWidth = this.#halfWidth;
    const halfHeight = this.#halfHeight;
    this.#x = Math.max(-halfWidth + 30, Math.min(halfWidth - 30, this.#x + dx * PLAYER_SPEED * deltaTime));
    this.#y = Math.max(-halfHeight + 30, Math.min(halfHeight - 60, this.#y + dy * PLAYER_SPEED * deltaTime));
    this.#player.setPosition(this.#x, this.#y, 1);
    this.#player.rotation = -dx * 0.15;

    // the guns fire on their own
    this.#cooldown -= deltaTime;
    if (this.#cooldown <= 0) {
      this.#cooldown = FIRE_INTERVAL;
      const bullet = this.#bullets.find((b) => !b.live);
      if (bullet) {
        bullet.live = true;
        bullet.x = this.#x;
        bullet.y = this.#y + 30;
      }
    }

    for (const bullet of this.#bullets) {
      if (bullet.live) {
        bullet.y += BULLET_SPEED * deltaTime;
        if (bullet.y > halfHeight + 20) bullet.live = false;
      }
      bullet.sprite.setPosition(bullet.x, bullet.y, 0);
      bullet.sprite.setColor(BULLET_TINT, bullet.live ? 1 : 0);
    }

    let scored = false;
    for (const enemy of this.#enemies) {
      enemy.phase += deltaTime;
      enemy.y -= enemy.speed * deltaTime;
      const x = enemy.x + Math.sin(enemy.phase * 1.4) * 40;
      if (enemy.y < -halfHeight - 40) this.#respawn(enemy, halfHeight + 40);
      for (const bullet of this.#bullets) {
        if (bullet.live && Math.abs(bullet.x - x) < 24 && Math.abs(bullet.y - enemy.y) < 24) {
          bullet.live = false;
          this.#score += 100;
          scored = true;
          this.#respawn(enemy, halfHeight + 40);
          break;
        }
      }
      enemy.sprite.setPosition(x, enemy.y, 1);
    }
    if (scored) this.#writeScore();

    this.#ships.update();
    this.#shots.update();
  }

  dispose(): void {
    this.renderer.dispose();
    this.#glow.dispose();
    this.#pipeline.dispose();
    this.#ships.dispose();
    this.#shots.dispose();
    this.#text.dispose();
    this.world.dispose();
    this.hud.dispose();
  }
}
