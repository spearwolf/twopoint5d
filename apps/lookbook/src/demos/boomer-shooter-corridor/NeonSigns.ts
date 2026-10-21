import {
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  flatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  type SpriteOf,
  type TextureAtlas,
  TextureColor,
  Tint,
  Yaw,
  type FeatureSpritesOf,
} from '@spearwolf/twopoint5d';
import type {Texture} from 'three/webgpu';
import {CORRIDOR_HEIGHT, CORRIDOR_LENGTH, CORRIDOR_WIDTH, TILE} from './Corridor';

// signs flat on the walls, turned by their yaw to face into the corridor; Tint above 1 makes them glow
const SignKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, flatPlacement({orientation: 'yaw'}), Yaw, QuadSize, AtlasFrame, TextureColor, Tint],
});

type Sign = SpriteOf<typeof SignKind>;

// the texel size of the corridor: 64 pixels a tile
const PX = TILE / 64;
// a hair in front of the wall, so the sign does not fight the wall for the depth
const OFF_WALL = 0.02;

interface Placement {
  frame: string;
  /** −1 the left wall (x < 0), 1 the right one, 0 above the far door */
  wall: -1 | 0 | 1;
  z: number;
  y: number;
  /** the colour of its tube, as the asset README gives it */
  tube: string;
  flicker?: boolean;
}

const SIGNS: Placement[] = [
  {frame: 'sign-noodle', wall: -1, z: -13, y: 3.1, tube: '#ff3ac8'},
  {frame: 'sign-bar', wall: 1, z: -9.5, y: 3.4, tube: '#3ae8ff'},
  {frame: 'sign-open', wall: -1, z: -17.5, y: 2.9, tube: '#4aff8a'},
  {frame: 'sign-love', wall: 1, z: -22, y: 2.6, tube: '#ff6ab0'},
  {frame: 'sign-danger', wall: 1, z: -28.5, y: 3.2, tube: '#ffb030', flicker: true},
  {frame: 'sign-noodle', wall: -1, z: -33.5, y: 3.5, tube: '#ff3ac8'},
  {frame: 'sign-bar', wall: -1, z: -38, y: 2.7, tube: '#3ae8ff'},
  {frame: 'sign-exit', wall: 0, z: -CORRIDOR_LENGTH, y: 4.55, tube: '#ff3a4a'},
];

// the bloom lets in what is brighter than white by luminance, not by its brightest channel: a
// saturated tube needs a factor of about threshold / luminance to pass (docs/sprites.md, "Glow")
const GLOW_LUMINANCE = 1.25;

/** The luminance of an sRGB colour `#rrggbb` once it is linear, as the threshold of the bloom measures it. */
function linearLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

interface SignState {
  sprite: Sign;
  glow: number;
  flicker: boolean;
}

/** The neon signs on the walls of the corridor; one of them flickers. */
export class NeonSigns {
  readonly sprites: FeatureSpritesOf<typeof SignKind>;
  readonly #signs: SignState[] = [];
  #flickerUntil = 0;
  #nextFlicker = 2;

  constructor({atlas, texture}: {atlas: TextureAtlas; texture: Texture}) {
    const sprites = new FeatureSprites(SignKind, {
      capacity: SIGNS.length,
      textures: {colorMap: texture},
      // the flicker writes the tint every frame
      attributeUsage: {dynamic: ['color']},
      // the glass tubes have soft rings of glow around them: they blend, and write no depth
      transparent: true,
      depthWrite: false,
    });
    sprites.name = 'neon-signs';
    sprites.frustumCulled = false;
    // after the stalkers, whose depth the rings of glow then respect
    sprites.renderOrder = 1;

    for (const sign of SIGNS) {
      const sprite = sprites.createSprite();
      const frame = atlas.frame(sign.frame);
      if (sprite == null || frame == null) continue;
      sprite.setFrame(frame);
      sprite.setSize(frame.coords.width * PX, frame.coords.height * PX);
      if (sign.wall === 0) {
        sprite.setPosition(0, sign.y, sign.z + OFF_WALL);
        sprite.yaw = 0;
      } else {
        sprite.setPosition(sign.wall * (CORRIDOR_WIDTH / 2 - OFF_WALL), Math.min(sign.y, CORRIDOR_HEIGHT - 0.8), sign.z);
        // the left wall faces +x, the right one −x
        sprite.yaw = -sign.wall * (Math.PI / 2);
      }
      const glow = Math.min(3.6, Math.max(2, GLOW_LUMINANCE / linearLuminance(sign.tube)));
      sprite.setColorValues(glow, glow, glow, 1);
      this.#signs.push({sprite, glow, flicker: sign.flicker === true});
    }
    sprites.update();
    this.sprites = sprites;
  }

  /** Lets the faulty sign stutter now and then; `time` in seconds. */
  update(time: number) {
    if (time > this.#nextFlicker) {
      this.#flickerUntil = time + 0.4 + Math.random() * 0.8;
      this.#nextFlicker = this.#flickerUntil + 2 + Math.random() * 5;
    }
    const stutter = time < this.#flickerUntil && Math.sin(time * 90) * Math.sin(time * 37) > -0.1;
    for (const sign of this.#signs) {
      if (!sign.flicker) continue;
      const level = stutter ? 0.15 : sign.glow;
      sign.sprite.setColorValues(level, level, level, 1);
    }
    this.sprites.update();
  }

  dispose() {
    this.sprites.dispose();
  }
}
