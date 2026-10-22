import {
  AtlasFrame,
  type BitmapFont,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  Flash,
  InstancePosition,
  layoutText,
  PaletteSwap,
  QuadBase,
  QuadSize,
  rewriteText,
  type SpriteOf,
  type TextureAtlas,
  TextureColor,
  TexturedSpriteKind,
  type TileSet,
  Tint,
  wave,
  writeText,
  type FeatureSpritesOf,
} from '@spearwolf/twopoint5d';
import {Group, type Texture} from 'three/webgpu';

/** What the page loaded: two bitmap fonts, the copper bars, the saber strips and the tunnel. */
export interface SineScrollerAssets {
  /** `chrome-32`: the scroller font, its page and the palette its colours cycle through */
  chromeFont: BitmapFont;
  chromePage: Texture;
  chromePalette: Texture;
  /** `pixel-8`: a plain white font, coloured by `Tint` */
  pixelFont: BitmapFont;
  pixelPage: Texture;
  /** `copper-bars.png` cut into nine tiles of 4 × 16 */
  copperBars: TileSet;
  copperTexture: Texture;
  /** `saber-glow`: one strip of 64 × 16 per saber colour */
  sabers: TextureAtlas;
  saberTexture: Texture;
  /** `cycle-tunnel`: a spiral in 16 greys, and the palette that colours them */
  tunnel: Texture;
  tunnelPalette: Texture;
}

// The glyphs of the scroller: laid out once by writeText(), moved along x by the CPU, bent on a sine
// by wave() in the shader, their colours swapped and cycled by PaletteSwap and pushed above white by
// Tint, so the bright bands of the chrome bloom as they run through the letters
const ChromeKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, PaletteSwap, Tint, wave({weight: 'uniform'})],
});

// the tunnel is the whole texture, no atlas: the frame of a kind without a frame feature is the image
const TunnelKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, PaletteSwap, Tint],
});

// copper bars and light sabers: a strip stretched across the screen, tinted, flashed on the beat
const BarKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Tint, Flash],
});

type Glyph = SpriteOf<typeof ChromeKind>;
type Bar = SpriteOf<typeof BarKind>;
type PixelGlyph = SpriteOf<typeof TexturedSpriteKind>;

export const SCROLL_TEXT =
  '*** TWOPOINT5D LOOKBOOK PRESENTS THE SINE SCROLLER ***     ' +
  'BITMAPFONT.PARSE() READS THE CHROME FONT, WRITETEXT() LAYS IT OUT ONCE, AND WAVE() BENDS EVERY GLYPH IN THE SHADER - ' +
  'THE CPU ONLY MOVES X ...     PALETTESWAP CYCLES COLOURS 1 TO 15 OF THE FONT, A TINT ABOVE 1 AND THE BLOOM DO THE GLOW ...     ' +
  'GREETINGS FLY OUT TO FAIRLIGHT - KEFRENS - RED SECTOR - SANITY - SCOOPEX - THE SILENTS - ' +
  'AND EVERY CODER, PIXELER AND TRACKER MUSICIAN STILL WAITING FOR DISK 2 TO LOAD ...     ';

const TITLE_TEXT = 'TWOPOINT5D * LOOKBOOK * SINE SCROLLER';
const INFO_TEXT = 'BitmapFont + writeText()  *  wave({weight: uniform})  *  PaletteSwap colour cycling  *  Tint > 1 + bloom';

/** The rows of `chrome-32-palette.png`, row 0 the source chrome. */
export const FONT_PALETTES = ['chrome', 'rainbow', 'copper', 'ice'] as const;
/** The rows of `cycle-tunnel-palette.png`, row 0 the source greys. */
export const TUNNEL_PALETTES = ['grey', 'rainbow', 'fire', 'sea'] as const;

// scene depth, back to front: the orthographic camera looks down −z, the depth test layers them
const Z_TUNNEL = 0;
const Z_COPPER = 10;
const Z_SABER = 30;
const Z_CHROME = 40;
const Z_TEXT = 50;

// pixels of the view per second; whole pixels a frame keep the glyphs on the pixel grid
const SCROLL_SPEED = 120;
// entries per second: the chrome cycles fast, the tunnel crawls
const CHROME_CYCLE_SPEED = 14;
const TUNNEL_CYCLE_SPEED = 10;
const BEATS_PER_MINUTE = 125;

// bars 0–7 roll (red … magenta); bar 8, the greys, stays in the atlas for a tint of one's own
const COPPER_BAR_COUNT = 8;

// a colour above white: the threshold of the bloom compares *luminance*, 0.2126 r + 0.7152 g + 0.0722 b,
// so a saturated colour needs a factor of about threshold / coefficient — red 5, blue 14 — or some
// white mixed in. Each saber tint below lifts the white core of the strip to a luminance of about 1.35,
// in the hue of the saber, and leaves its coloured edges below 1: only the core blooms, and a strip
// across the whole screen does not fog it
const SABER_TINTS = {
  'saber-cyan': [0.6, 1.5, 2.2], // 0.13 + 1.07 + 0.16 = 1.36
  'saber-red': [3, 0.9, 0.9], // 0.64 + 0.64 + 0.06 = 1.34 — a pure [3, 0, 0] would reach 0.64 and stay dark
} as const;
// on the beat the sabers flash towards a white above white
const SABER_FLASH = 2;
// the chrome at 1.2: its white and pale gold bands (luminance 1) reach 1.2 and bloom, the rest stays out
const CHROME_TINT = 1.2;
// the title of pixel-8, white × this, a luminance of 1.31: a faint cyan glow
const TITLE_TINT = [0.9, 1.4, 1.7] as const;
const INFO_TINT = [1, 0.78, 0.42] as const;
// the tunnel stays in the background; a tint works on the linear colour, so 0.1 is about a third
// of the brightness on the screen. cycle-tunnel.png is 128 × 128
const TUNNEL_TINT = 0.1;
const TUNNEL_SIZE = 128;

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * An old-school Amiga screen out of four kinds of sprites: a colour-cycled tunnel, rolling copper
 * bars, two light sabers, a chrome sine scroller and two lines of a small pixel font. The view is
 * measured in pixels of the art — the page scales it by a whole number — and centred on the origin.
 */
export class SineScroller extends Group {
  readonly tunnel: FeatureSpritesOf<typeof TunnelKind>;
  readonly copper: FeatureSpritesOf<typeof BarKind>;
  readonly sabers: FeatureSpritesOf<typeof BarKind>;
  readonly chrome: FeatureSpritesOf<typeof ChromeKind>;
  readonly text: FeatureSpritesOf<typeof TexturedSpriteKind>;

  /** Flash the sabers on every beat. */
  beatFlash = true;

  readonly #assets: SineScrollerAssets;
  readonly #tunnelSprite: SpriteOf<typeof TunnelKind> | undefined;
  readonly #copperBars: Bar[] = [];
  readonly #saberBars: Bar[] = [];
  readonly #glyphs: Glyph[];
  // where writeText() put each glyph: the scroll is an offset from there
  readonly #home: number[];
  readonly #textWidth: number;
  readonly #titleGlyphs: PixelGlyph[] = [];
  readonly #infoGlyphs: PixelGlyph[] = [];

  #width = 0;
  #height = 0;
  #copperAmplitude = 0;
  #saberY = 0;
  #saberLength = 0;
  #loopLength = 0;
  #fontPalette = 0;
  #tunnelPalette = 2;

  constructor(assets: SineScrollerAssets) {
    super();
    this.name = 'sine scroller';
    this.#assets = assets;

    // --- the tunnel: 16 greys, every one of them cycled -----------------------------------------
    this.tunnel = new FeatureSprites(TunnelKind, {
      capacity: 1,
      textures: {colorMap: assets.tunnel, palette: assets.tunnelPalette},
      // the whole palette cycles: count 0 runs to its end
      uniforms: {paletteCycle: [0, 0]},
    });
    this.tunnel.name = 'tunnel';
    this.#tunnelSprite = this.tunnel.createSprite();
    if (this.#tunnelSprite != null) {
      this.#tunnelSprite.setPosition(0, 0, Z_TUNNEL);
      this.#tunnelSprite.setColorValues(TUNNEL_TINT, TUNNEL_TINT, TUNNEL_TINT, 1);
      this.#tunnelSprite.paletteRow = this.#tunnelPalette;
    }

    // --- copper bars: opaque, the depth test sorts the front ones over the back ones -------------
    this.copper = new FeatureSprites(BarKind, {capacity: COPPER_BAR_COUNT, textures: {colorMap: assets.copperTexture}});
    this.copper.name = 'copper bars';
    for (let i = 0; i < COPPER_BAR_COUNT; i++) {
      const bar = this.copper.createSprite()!;
      // the tile ids of a TileSet start at its firstId; tile n is bar n of the image
      bar.setFrame(assets.copperBars.frame(assets.copperBars.firstId + i));
      this.#copperBars.push(bar);
    }

    // --- light sabers: soft edges, so blended; a tint above white makes them bloom ----------------
    this.sabers = new FeatureSprites(BarKind, {
      capacity: 2,
      textures: {colorMap: assets.saberTexture},
      transparent: true,
      depthWrite: false,
    });
    this.sabers.name = 'light sabers';
    for (const [name, [r, g, b]] of Object.entries(SABER_TINTS)) {
      const saber = this.sabers.createSprite()!;
      saber.setFrame(assets.sabers.frame(name)!);
      saber.setColorValues(r, g, b, 1);
      this.#saberBars.push(saber);
    }

    // --- the scroller: one sprite per glyph, written once ----------------------------------------
    this.chrome = new FeatureSprites(ChromeKind, {
      capacity: 512,
      textures: {colorMap: assets.chromePage, palette: assets.chromePalette},
      uniforms: {
        // entry 0 is the outline, the same in every row; entries 1–15 are the gradient that cycles
        paletteCycle: [1, 15],
        // a wave every 320 pixels, a quarter of a wave per second; the amplitude follows the view
        waveFrequency: 1 / 320,
        waveSpeed: 0.25,
        waveAmplitude: 32,
      },
    });
    this.chrome.name = 'chrome scroller';
    // the top of the line 16 above the middle of the scroller: the capitals sit around y = 0
    this.#glyphs = writeText(this.chrome, assets.chromeFont, SCROLL_TEXT, {x: 0, y: 16, z: Z_CHROME});
    this.#home = this.#glyphs.map((glyph) => glyph.x);
    this.#textWidth = layoutText(assets.chromeFont, SCROLL_TEXT).width;
    for (const glyph of this.#glyphs) glyph.setColorValues(CHROME_TINT, CHROME_TINT, CHROME_TINT, 1);

    // --- the small font: a title on top, what is shown at the bottom ------------------------------
    this.text = new FeatureSprites(TexturedSpriteKind, {capacity: 256, textures: {colorMap: assets.pixelPage}});
    this.text.name = 'pixel-8 text';

    this.add(this.tunnel, this.copper, this.sabers, this.chrome, this.text);
  }

  /** The row of `chrome-32-palette.png` every glyph is drawn in, 0 the chrome itself. */
  get fontPalette(): number {
    return this.#fontPalette;
  }

  set fontPalette(row: number) {
    this.#fontPalette = row;
    for (const glyph of this.#glyphs) glyph.paletteRow = row;
    // paletteRow is a static attribute: a change after the first upload goes up once it is marked
    this.chrome.geometry?.touch('paletteRow');
  }

  /** The row of `cycle-tunnel-palette.png` the tunnel is drawn in, 0 the greys. */
  get tunnelPalette(): number {
    return this.#tunnelPalette;
  }

  set tunnelPalette(row: number) {
    this.#tunnelPalette = row;
    if (this.#tunnelSprite == null) return;
    this.#tunnelSprite.paletteRow = row;
    this.tunnel.spritePool?.touchVO(this.#tunnelSprite, 'paletteRow');
  }

  /**
   * Lays the screen out for a view of `width` × `height` pixels of the art. The static texts are
   * written anew here, never per frame: rewriteText() allocates.
   */
  layout(width: number, height: number): void {
    if (width === this.#width && height === this.#height) return;
    this.#width = width;
    this.#height = height;

    // the view is centred on the origin; a view of an odd size would put every edge of the art
    // between two screen pixels, so the whole group moves by the half pixel: the edges of the
    // screen lie at x = −ceil(width / 2) … floor(width / 2) of the group, y alike
    this.position.set(Math.ceil(width / 2) - width / 2, Math.ceil(height / 2) - height / 2, 0);

    // the tunnel at a whole-number scale that covers the screen
    if (this.#tunnelSprite != null) {
      const scale = Math.ceil(Math.max(width, height) / TUNNEL_SIZE);
      this.#tunnelSprite.setSize(TUNNEL_SIZE * scale, TUNNEL_SIZE * scale);
      this.tunnel.spritePool?.touchVO(this.#tunnelSprite, 'quadSize');
    }

    const waveAmplitude = Math.round(Math.min(48, Math.max(16, height * 0.12)));
    this.chrome.setUniform('waveAmplitude', waveAmplitude);

    // a pixel wider on either side: the group sits up to a pixel off the middle (see above)
    for (const bar of this.#copperBars) bar.setSize(Math.ceil(width) + 2, 16);
    this.copper.geometry?.touch('quadSize');
    // the sabers frame the band the scroller waves in, and the copper bars roll inside it. A blade
    // is a strip of the atlas stretched to its length — every column of a strip is the same. Not
    // across the whole screen: whatever passes the threshold blooms with all of its area, and two
    // blades from edge to edge would fog the screen
    this.#saberY = waveAmplitude + 32;
    this.#copperAmplitude = this.#saberY - 12;
    this.#saberLength = 2 * Math.round(Math.min(width * 0.45, 256) / 2);
    for (const saber of this.#saberBars) saber.setSize(this.#saberLength, 16);
    this.sabers.geometry?.touch('quadSize');

    // the glyphs leave the screen on the left and come back on the right: the loop is at least
    // the screen and a glyph on either side long, and a whole number, so no glyph leaves the grid
    this.#loopLength = Math.ceil(Math.max(this.#textWidth + width / 2, width + 2 * 64));

    this.#writeStaticText(width, height);
  }

  #writeStaticText(width: number, height: number): void {
    // rewriteText() reuses the sprites of the last size: a resize creates and frees none
    const font = this.#assets.pixelFont;
    const title = rewriteText(this.text, this.#titleGlyphs, font, TITLE_TEXT, {
      x: 0,
      y: Math.floor(height / 2) - 8,
      z: Z_TEXT,
      align: 'center',
    });
    for (const glyph of title) glyph.setColorValues(...TITLE_TINT, 1);

    // word-wrapped at the screen's width; layoutText() measures it first, to stand it on the bottom edge
    const options = {x: 0, z: Z_TEXT, align: 'center', maxWidth: width - 16} as const;
    const {height: infoHeight} = layoutText(font, INFO_TEXT, options);
    const info = rewriteText(this.text, this.#infoGlyphs, font, INFO_TEXT, {
      ...options,
      y: -Math.ceil(height / 2) + 6 + infoHeight,
    });
    for (const glyph of info) glyph.setColorValues(...INFO_TINT, 1);

    this.text.update();
  }

  /** One frame at `time` seconds: everything that moves, then one upload per mesh. */
  update(time: number): void {
    if (this.#width === 0) return;

    // the tunnel turns by cycling its colours alone
    this.tunnel.setUniform('paletteShift', time * TUNNEL_CYCLE_SPEED);

    // the copper bars roll on a circle seen from the side: y is the sine, the depth the cosine
    this.#copperBars.forEach((bar, i) => {
      const angle = time * 1.7 - i * 0.38;
      bar.setPosition(0, Math.round(Math.sin(angle) * this.#copperAmplitude), Z_COPPER + Math.cos(angle) * 4);
    });

    // the beat: the sabers flash towards a white above white, and the flash fades out
    const secondsPerBeat = 60 / BEATS_PER_MINUTE;
    const sinceBeat = mod(time, secondsPerBeat);
    const flash = this.beatFlash ? 0.6 * Math.exp(-sinceBeat * 10) : 0;
    // the blades sweep along their bars, the upper one against the lower, a little beyond the edges
    const sweep = this.#width / 2 - this.#saberLength / 4;
    this.#saberBars.forEach((saber, i) => {
      const x = Math.round(Math.sin(time * 0.8 + i * Math.PI) * sweep);
      saber.setPosition(x, i === 0 ? this.#saberY : -this.#saberY, Z_SABER);
      saber.setFlash(SABER_FLASH, SABER_FLASH, SABER_FLASH, flash);
    });

    // the scroll: whole pixels, so every glyph keeps its edges on the pixel grid of the art
    const scroll = Math.round(time * SCROLL_SPEED);
    // the left edge of the screen lies on a whole pixel (see layout()), and so does this
    const left = -Math.ceil(this.#width / 2) - 64;
    for (let i = 0; i < this.#glyphs.length; i++) {
      // x alone: the y writeText() gave the glyph stays, and wave() moves it in the shader
      this.#glyphs[i]!.x = left + mod(this.#home[i]! - scroll, this.#loopLength);
    }
    this.chrome.setUniform('time', time);
    this.chrome.setUniform('paletteShift', time * CHROME_CYCLE_SPEED);

    this.tunnel.update();
    this.copper.update();
    this.sabers.update();
    this.chrome.update();
  }

  override dispose(): void {
    this.tunnel.dispose();
    this.copper.dispose();
    this.sabers.dispose();
    this.chrome.dispose();
    this.text.dispose();
    this.removeFromParent();
  }
}
