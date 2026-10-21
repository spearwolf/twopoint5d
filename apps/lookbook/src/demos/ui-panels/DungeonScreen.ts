import {
  type BitmapFont,
  DynamicAtlas,
  FeatureSprites,
  layoutText,
  type TexturedSprite,
  TexturedSpriteKind,
  type TextureAtlas,
  type TextureAtlasFrame,
  type WriteTextOptions,
  writeText,
  type FeatureSpritesOf,
} from '@spearwolf/twopoint5d';
import {Color, Group, type Texture} from 'three/webgpu';

import {type Panel, PanelKind, type Picture, PictureKind} from './kinds.js';
import {DIALOG, INVENTORY, INVENTORY_COLUMNS, INVENTORY_ROWS, PARTY, type PartyMemberData, QUEST, TITLE} from './party.js';
import {PixelLabels} from './PixelLabels.js';

/** The panels of the kit a window can be drawn with: each a slice of its own, with insets of its own. */
export type PanelStyle = 'panel-stone' | 'panel-wood' | 'panel-parchment' | 'panel-dark';

export const PANEL_STYLES: readonly PanelStyle[] = ['panel-stone', 'panel-wood', 'panel-parchment', 'panel-dark'];

export interface DungeonScreenAssets {
  /** `panels.aseprite.json`: one frame over the whole kit, one slice with a `center` per panel. */
  kit: TextureAtlas;
  kitTexture: Texture;
  /** `icons.json`, TexturePacker. */
  icons: TextureAtlas;
  iconsTexture: Texture;
  font: BitmapFont;
  fontTexture: Texture;
  /** The page of the font once more, as an image the labels are drawn from on the CPU. */
  fontImage: HTMLImageElement;
  /** The portraits by the `id` of the party member. */
  portraits: ReadonlyMap<string, HTMLImageElement>;
}

type PanelSprites = FeatureSpritesOf<typeof PanelKind>;
type TextSprites = FeatureSpritesOf<typeof TexturedSpriteKind>;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// The layout is measured in pixels of the kit, from the top left corner of the canvas below the
// controls of the page, y down. A pixel of the kit is `scale` units of the stage, and a unit of
// the stage is a CSS pixel of the canvas.
const MARGIN = 4;
const PAD = 14;
const CONTENT_TOP = 34;
const CARD_W = 156;
const CARD_H = 50;
const CARD_GAP = 4;
const BAR_W = 58;
const BAR_INNER = BAR_W - 6;
const PORTRAIT = 28;
const SLOT = 20;
const INVENTORY_W = INVENTORY_COLUMNS * SLOT + 20;
const INVENTORY_H = 24 + INVENTORY_ROWS * SLOT + 22;
const DIALOG_H = 64;
const BUTTON_W = 44;
const BUTTON_H = 16;
// the narrowest stage the layout fills without overlap, and the least height it needs
const MIN_W = 2 * PAD + 2 * CARD_W + CARD_GAP + 8 + INVENTORY_W;
const MIN_H = 290;

const GOLD = new Color('#ffd166');
const INK = new Color('#3a2414');
const PAPER = new Color('#f2e6c6');
const TOOLTIP_TEXT = new Color('#fff4d6');

const TYPE_SPEED = 32; // glyphs per second
const LINE_PAUSE = 3.2; // seconds a typed line stays before the next one
const OPEN_INVENTORY_SECONDS = 0.45;
const OPEN_DIALOG_SECONDS = 0.5;
const COMBAT_TICK = 1.5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
// overshoots by 5 % and settles
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const easeInCubic = (t: number) => t * t * t;
// frame-rate independent smoothing towards a target
const approach = (value: number, target: number, rate: number, dt: number) => target + (value - target) * Math.exp(-rate * dt);
const inside = (rect: Rect, x: number, y: number) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;

/** Text written with `writeText()`: freed and written anew when it changes, never every frame. */
class TextBlock {
  glyphs: TexturedSprite[] = [];
  #shown = 0;

  constructor(
    readonly sprites: TextSprites,
    readonly font: BitmapFont,
  ) {}

  write(text: string, options: WriteTextOptions, color: Color): void {
    this.clear();
    this.glyphs = writeText(this.sprites, this.font, text, options);
    for (const glyph of this.glyphs) glyph.setColor(color, 1);
    this.#shown = this.glyphs.length;
  }

  /**
   * Shows the first `count` glyphs and hides the rest — by their alpha, which the default alpha
   * test of the material drops at 0. The text is laid out whole, so a word being typed never
   * jumps to the next line.
   */
  reveal(count: number): void {
    const next = clamp(Math.floor(count), 0, this.glyphs.length);
    if (next === this.#shown) return;
    for (let i = Math.min(next, this.#shown); i < Math.max(next, this.#shown); i++) {
      const glyph = this.glyphs[i]!;
      glyph.a = i < next ? 1 : 0;
      // the tint is a static attribute: a change reaches the gpu once it is marked
      this.sprites.spritePool?.touchVO(glyph, 'color');
    }
    this.#shown = next;
  }

  clear(): void {
    for (const glyph of this.glyphs) this.sprites.freeSprite(glyph);
    this.glyphs = [];
    this.#shown = 0;
  }
}

interface LabelFrames {
  portrait: TextureAtlasFrame;
  name: TextureAtlasFrame;
  hp: TextureAtlasFrame;
  mp: TextureAtlasFrame;
}

interface MemberCard {
  data: PartyMemberData;
  hp: number;
  mp: number;
  shownHp: number;
  shownMp: number;
  drawnHp: string;
  drawnMp: string;
  flash: number;
  flashColor: Color;
  frames?: LabelFrames;
  rect: Rect;
  card: Panel;
  backdrop: Panel;
  portraitFrame: Panel;
  hpBar: Panel;
  hpFill: Panel;
  mpBar: Panel;
  mpFill: Panel;
  portrait: Picture;
  name: Picture;
  hpLabel: Picture;
  mpLabel: Picture;
}

/**
 * The screen of a dungeon crawler in five draw calls: the panels of the UI kit, the item icons,
 * the pictures of a `DynamicAtlas` — portraits and labels drawn at run time —, the panels that
 * hover over the icons, and the bitmap text.
 */
export class DungeonScreen extends Group {
  /** Called once, when the first line of the dialog is typed out: the scene is composed. */
  onComposed?: () => void;

  readonly #assets: DungeonScreenAssets;
  readonly #kitFrame: TextureAtlasFrame;
  readonly #atlas: DynamicAtlas;
  readonly #labels: PixelLabels;

  readonly #back: PanelSprites;
  readonly #icons: TextSprites;
  readonly #pictures: FeatureSpritesOf<typeof PictureKind>;
  readonly #front: PanelSprites;
  readonly #text: TextSprites;

  // the stage units of the top left corner of the layout, the units of a pixel of the kit, and
  // the size of the layout in pixels of the kit
  #left = 0;
  #top = 0;
  #scale = 0;
  #width = 0;
  #height = 0;

  #style: PanelStyle = 'panel-stone';

  readonly #main: Panel;
  readonly #divider: Panel;
  readonly #members: MemberCard[];
  readonly #quest: Panel;
  readonly #inventory: Panel;
  readonly #slots: Panel[];
  readonly #items: (TexturedSprite | undefined)[];
  readonly #dialog: Panel;
  readonly #namePlate: Panel;
  readonly #speakerBackdrop: Panel;
  readonly #speakerFrame: Panel;
  readonly #button: Panel;
  readonly #speakerPortrait: Picture;
  readonly #speakerName: Picture;
  readonly #cursor: Panel;
  readonly #tooltip: Panel;

  readonly #titleText: TextBlock;
  readonly #inventoryTitle: TextBlock;
  readonly #goldText: TextBlock;
  readonly #questText: TextBlock;
  readonly #dialogText: TextBlock;
  readonly #buttonText: TextBlock;
  readonly #tooltipText: TextBlock;

  #inventoryRect: Rect = {x: 0, y: 0, w: 0, h: 0};
  #slotRects: Rect[] = [];
  #dialogRect: Rect = {x: 0, y: 0, w: 0, h: 0};
  #buttonRect: Rect = {x: 0, y: 0, w: 0, h: 0};

  #inventoryOpen = true;
  #inventoryT = 0;
  #dialogT = 0;

  #line = 0;
  #typed = 0;
  #lineDone = 0;
  #composed = false;
  #speaker?: MemberCard;
  #namePlateW = 0;

  #selected = 0;
  #cursorX = 0;
  #cursorY = 0;
  #tooltipW = 0;
  #tooltipFor = -1;
  #autoSelect = 0;
  #pointerOverSlotAt = Number.NEGATIVE_INFINITY;

  #buttonHover = false;
  #buttonDown = false;
  #buttonFrame = 'button-up';
  #time = 0;
  #combat = 0;

  constructor(assets: DungeonScreenAssets) {
    super();
    this.#assets = assets;
    this.#kitFrame = assets.kit.frame('panels 0.aseprite')!;
    this.#labels = new PixelLabels(assets.font, assets.fontImage);

    // portraits, names and counters, packed at run time into one texture. Nearest: the labels are
    // pixel art, and the portraits are drawn into it at the size they are shown at
    this.#atlas = new DynamicAtlas({width: 512, height: 512, padding: 1, filter: 'nearest'});

    // a UI is drawn in the order of its layers, not by depth: five meshes one after the other, and
    // in each the sprites in the order they were created
    const layer = {transparent: true, depthTest: false, depthWrite: false};
    this.#back = new FeatureSprites(PanelKind, {capacity: 160, textures: {colorMap: assets.kitTexture}, ...layer});
    this.#icons = new FeatureSprites(TexturedSpriteKind, {capacity: 32, textures: {colorMap: assets.iconsTexture}, ...layer});
    this.#pictures = new FeatureSprites(PictureKind, {capacity: 32, textures: {colorMap: this.#atlas.texture}, ...layer});
    this.#front = new FeatureSprites(PanelKind, {capacity: 4, textures: {colorMap: assets.kitTexture}, ...layer});
    this.#text = new FeatureSprites(TexturedSpriteKind, {capacity: 1024, textures: {colorMap: assets.fontTexture}, ...layer});
    const meshes = [this.#back, this.#icons, this.#pictures, this.#front, this.#text] as const;
    const names = ['panels', 'icons', 'pictures', 'hover-panels', 'text'];
    meshes.forEach((mesh, i) => {
      mesh.name = `ui-panels.${names[i]}`;
      mesh.renderOrder = i;
      this.add(mesh);
    });

    // the panels, back to front
    this.#main = this.#panel(this.#back, this.#style);
    this.#divider = this.#panel(this.#back, 'divider');
    this.#members = PARTY.map((data) => this.#createCard(data));
    this.#quest = this.#panel(this.#back, 'panel-parchment');
    // the inventory opens from its top right corner
    this.#inventory = this.#panel(this.#back, this.#style, 1, 0);
    this.#slots = INVENTORY.map(() => this.#panel(this.#back, 'slot'));
    this.#items = INVENTORY.map((item) => {
      if (item == null) return undefined;
      const icon = this.#icons.createSprite()!;
      icon.setFrame(assets.icons.frame(item.icon)!);
      return icon;
    });
    // the dialog box opens upwards from its bottom left corner
    this.#dialog = this.#panel(this.#back, 'panel-dark', 0, 1);
    this.#namePlate = this.#panel(this.#back, 'tooltip');
    this.#speakerBackdrop = this.#panel(this.#back, 'slot');
    this.#speakerFrame = this.#panel(this.#back, 'portrait-frame');
    this.#button = this.#panel(this.#back, this.#buttonFrame);
    this.#speakerPortrait = this.#picture();
    this.#speakerName = this.#picture();
    // the cursor and the tooltip hover over the icons: a second mesh of the same kind and kit
    this.#cursor = this.#panel(this.#front, 'portrait-frame', 0.5, 0.5);
    this.#tooltip = this.#panel(this.#front, 'tooltip', 0.5, 0);

    this.#titleText = new TextBlock(this.#text, assets.font);
    this.#inventoryTitle = new TextBlock(this.#text, assets.font);
    this.#goldText = new TextBlock(this.#text, assets.font);
    this.#questText = new TextBlock(this.#text, assets.font);
    this.#dialogText = new TextBlock(this.#text, assets.font);
    this.#buttonText = new TextBlock(this.#text, assets.font);
    this.#tooltipText = new TextBlock(this.#text, assets.font);
  }

  get style(): PanelStyle {
    return this.#style;
  }

  /** Draws the main window and the inventory with another panel of the kit; its insets come along. */
  set style(style: PanelStyle) {
    this.#style = style;
    for (const panel of [this.#main, this.#inventory]) {
      panel.setSliceFrame(this.#kitFrame, style);
      // the frame and the insets are static attributes, both marked by the usage word texCoords
      this.#back.spritePool?.touchVO(panel, 'texCoords');
    }
    // the headings change their colour on parchment
    if (this.#scale > 0) this.#layout();
  }

  get inventoryOpen(): boolean {
    return this.#inventoryOpen;
  }

  /** Opens or closes the inventory window, animated. */
  set inventoryOpen(open: boolean) {
    this.#inventoryOpen = open;
  }

  /** The party member in the best shape takes a heavy blow. */
  hit(): void {
    const target = this.#members.reduce((a, b) => (b.hp / b.data.maxHp > a.hp / a.data.maxHp ? b : a));
    this.#damage(target, Math.ceil(target.data.maxHp * 0.4));
  }

  /**
   * Fits the screen into a stage of `width` × `height` units, the camera in its middle; the top
   * `topInset` units belong to the controls of the page.
   */
  resize(width: number, height: number, topInset: number): void {
    if (!(width > 0 && height > 0)) return;
    const inset = Math.ceil(topInset);
    // the largest whole scale the layout fits at: pixel art stays crisp
    const scale = clamp(Math.floor(Math.min(width / MIN_W, (height - inset) / MIN_H)), 1, 4);
    // the camera looks at the middle of the stage; the left and the top edge of the layout lie a
    // whole number of units from the edges of the canvas, so every pixel of the kit starts on a
    // pixel of the canvas
    this.#left = -width / 2;
    this.#top = height / 2 - inset;
    this.#width = Math.floor(width / scale);
    this.#height = Math.floor((height - inset) / scale);
    if (scale !== this.#scale) {
      this.#scale = scale;
      this.#fillAtlas();
    }
    this.#layout();
  }

  /** The pointer moved, in CSS pixels from the top left corner of the canvas; answers whether it is over the button. */
  pointerMove(x: number, y: number, topInset: number): boolean {
    if (this.#scale === 0) return false;
    const kx = x / this.#scale;
    const ky = (y - Math.ceil(topInset)) / this.#scale;
    this.#buttonHover = this.#dialogT >= 1 && inside(this.#buttonRect, kx, ky);
    if (this.#inventoryT >= 1) {
      const slot = this.#slotRects.findIndex((rect, i) => INVENTORY[i] != null && inside(rect, kx, ky));
      if (slot >= 0) {
        this.#selected = slot;
        this.#pointerOverSlotAt = this.#time;
      }
    }
    return this.#buttonHover;
  }

  pointerDown(x: number, y: number, topInset: number): void {
    this.pointerMove(x, y, topInset);
    this.#buttonDown = this.#buttonHover;
  }

  pointerUp(x: number, y: number, topInset: number): void {
    this.pointerMove(x, y, topInset);
    if (this.#buttonDown && this.#buttonHover) this.#next();
    this.#buttonDown = false;
  }

  /** Moves everything that moves, then uploads what changed. Once per frame, before rendering. */
  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    this.#time += dt;
    if (this.#scale > 0) {
      this.#animateDialog(dt);
      this.#animateInventory(dt);
      this.#animateParty(dt);
    }
    for (const mesh of [this.#back, this.#icons, this.#pictures, this.#front, this.#text]) mesh.update();
  }

  override dispose(): void {
    for (const mesh of [this.#back, this.#icons, this.#pictures, this.#front, this.#text]) mesh.dispose();
    // the atlas owns its canvas and its texture; the textures of the kit, the icons and the font
    // belong to the store that loaded them
    this.#atlas.dispose();
    this.removeFromParent();
  }

  // ---------------------------------------------------------------- building

  #panel(mesh: PanelSprites, slice: string, anchorX = 0, anchorY = 0): Panel {
    const panel = mesh.createSprite()!;
    // the frame and its border out of the slice of that name in panels.aseprite.json: its
    // bounds are the panel's rect in the sheet, its center the part that stretches
    panel.setSliceFrame(this.#kitFrame, slice);
    // anchorX from the left, anchorY from the top: (0, 0) places a panel by its top left corner
    panel.setAnchor(anchorX, anchorY);
    return panel;
  }

  #picture(): Picture {
    const picture = this.#pictures.createSprite()!;
    picture.setAnchor(0, 0);
    return picture;
  }

  #createCard(data: PartyMemberData): MemberCard {
    return {
      data,
      hp: data.maxHp,
      mp: data.maxMp,
      shownHp: data.maxHp,
      shownMp: data.maxMp,
      drawnHp: '',
      drawnMp: '',
      flash: 0,
      flashColor: new Color(),
      rect: {x: 0, y: 0, w: CARD_W, h: CARD_H},
      card: this.#panel(this.#back, 'panel-dark'),
      backdrop: this.#panel(this.#back, 'slot'),
      portraitFrame: this.#panel(this.#back, 'portrait-frame'),
      hpBar: this.#panel(this.#back, 'bar-frame'),
      hpFill: this.#panel(this.#back, 'bar-fill-red'),
      mpBar: this.#panel(this.#back, 'bar-frame'),
      mpFill: this.#panel(this.#back, 'bar-fill-blue'),
      portrait: this.#picture(),
      name: this.#picture(),
      hpLabel: this.#picture(),
      mpLabel: this.#picture(),
    };
  }

  /**
   * Packs the portraits and the labels into the atlas: the portraits scaled to the size they are
   * drawn at, the labels in pixels of the font. A frame never moves and keeps its size, so a new
   * scale starts the atlas over.
   */
  #fillAtlas(): void {
    this.#atlas.clear();
    const portraitSize = {width: PORTRAIT * this.#scale, height: PORTRAIT * this.#scale};
    for (const member of this.#members) {
      const {id, name, maxHp, maxMp} = member.data;
      member.drawnHp = this.#hpText(member);
      member.drawnMp = this.#mpText(member);
      const frames: LabelFrames = {
        portrait: this.#atlas.add(`portrait:${id}`, this.#assets.portraits.get(id)!, portraitSize),
        name: this.#atlas.add(`name:${id}`, this.#labels.draw(name, '#ffd166'), this.#labels.sizeOf(name)),
        // as wide as the widest counter they will show, so that every redraw() fits
        hp: this.#atlas.add(
          `hp:${id}`,
          this.#labels.draw(member.drawnHp, this.#hpColor(member)),
          this.#labels.sizeOf(`${maxHp}/${maxHp}`),
        ),
        mp: this.#atlas.add(`mp:${id}`, this.#labels.draw(member.drawnMp, '#9ec8ff'), this.#labels.sizeOf(`${maxMp}/${maxMp}`)),
      };
      member.frames = frames;
      member.portrait.setFrame(frames.portrait);
      member.name.setFrame(frames.name);
      member.hpLabel.setFrame(frames.hp);
      member.mpLabel.setFrame(frames.mp);
    }
    this.#showSpeaker();
  }

  // ---------------------------------------------------------------- layout

  /** A panel at `x, y` — the point its anchor names —, `w` × `h` pixels of the kit large. */
  #placePanel(mesh: PanelSprites, panel: Panel, x: number, y: number, w: number, h: number): void {
    const s = this.#scale;
    panel.setPosition(this.#left + x * s, this.#top - y * s);
    panel.setSize(w * s, h * s);
    // a pixel of the border takes `s` units of the stage, whatever size the panel is stretched to
    panel.sliceScale = s;
    mesh.spritePool?.touchVO(panel);
  }

  /**
   * A picture of the atlas, its top left corner at `x, y`, a texel of its frame `texel` units large:
   * 1 for a portrait, packed at its size on the canvas, the scale for a label, packed in pixels of the font.
   */
  #placePicture(picture: Picture, frame: TextureAtlasFrame | undefined, x: number, y: number, texel: number): void {
    if (frame == null) return;
    const s = this.#scale;
    picture.setPosition(this.#left + x * s, this.#top - y * s);
    picture.setSize(frame.coords.width * texel, frame.coords.height * texel);
    this.#pictures.spritePool?.touchVO(picture);
  }

  #hide(mesh: PanelSprites | TextSprites | FeatureSpritesOf<typeof PictureKind>, sprite: Panel | TexturedSprite | Picture): void {
    if (sprite.width === 0) return;
    sprite.setSize(0, 0);
    mesh.spritePool?.touchVO(sprite, 'quadSize');
  }

  #layout(): void {
    const w = this.#width;
    const h = this.#height;

    // the main window follows the size of the canvas
    this.#placePanel(this.#back, this.#main, MARGIN, MARGIN, w - 2 * MARGIN, h - 2 * MARGIN);
    // a divider stretches in x alone: its insets are 5, 0, 5, 0
    this.#placePanel(this.#back, this.#divider, MARGIN + 8, PAD + 11, w - 2 * (MARGIN + 8), 5);

    this.#members.forEach((member, i) => {
      const x = PAD + (i % 2) * (CARD_W + CARD_GAP);
      const y = CONTENT_TOP + Math.floor(i / 2) * (CARD_H + CARD_GAP);
      member.rect = {x, y, w: CARD_W, h: CARD_H};
      this.#placePanel(this.#back, member.card, x, y, CARD_W, CARD_H);
      // a sunken slot as the backdrop of the portrait, the frame — clear inside — on top
      this.#placePanel(this.#back, member.backdrop, x + 5, y + 5, 40, 40);
      this.#placePanel(this.#back, member.portraitFrame, x + 5, y + 5, 40, 40);
      this.#placePanel(this.#back, member.hpBar, x + 49, y + 17, BAR_W, 10);
      this.#placePanel(this.#back, member.mpBar, x + 49, y + 31, BAR_W, 10);
      this.#placePicture(member.portrait, member.frames?.portrait, x + 11, y + 11, 1);
      this.#placePicture(member.name, member.frames?.name, x + 49, y + 5, this.#scale);
      this.#placePicture(member.hpLabel, member.frames?.hp, x + 110, y + 18, this.#scale);
      this.#placePicture(member.mpLabel, member.frames?.mp, x + 110, y + 32, this.#scale);
      this.#placeBars(member);
    });

    // the inventory hangs from the top right corner of the main window
    this.#inventoryRect = {x: w - PAD - INVENTORY_W, y: CONTENT_TOP, w: INVENTORY_W, h: INVENTORY_H};
    const inv = this.#inventoryRect;
    this.#slotRects = INVENTORY.map((_, i) => ({
      x: inv.x + 10 + (i % INVENTORY_COLUMNS) * SLOT,
      y: inv.y + 24 + Math.floor(i / INVENTORY_COLUMNS) * SLOT,
      w: SLOT,
      h: SLOT,
    }));

    // the dialog box stands on the bottom edge, as wide as the main window
    this.#dialogRect = {x: PAD, y: h - PAD - DIALOG_H, w: w - 2 * PAD, h: DIALOG_H};
    const d = this.#dialogRect;
    this.#buttonRect = {x: d.x + d.w - 8 - BUTTON_W, y: d.y + d.h - 8 - BUTTON_H, w: BUTTON_W, h: BUTTON_H};

    // the quest scroll takes the room left between the roster and the dialog box
    const questTop = Math.max(CONTENT_TOP + 3 * (CARD_H + CARD_GAP), inv.y + inv.h + CARD_GAP) + 2;
    const questBottom = d.y - 12;
    if (questBottom - questTop >= 26) {
      this.#placePanel(this.#back, this.#quest, PAD, questTop, w - 2 * PAD, questBottom - questTop);
    } else {
      this.#hide(this.#back, this.#quest);
    }

    this.#writeTexts(questTop, questBottom);
    this.#placeInventory();
    this.#placeDialog();
  }

  #writeTexts(questTop: number, questBottom: number): void {
    const s = this.#scale;
    this.#titleText.write(
      TITLE,
      {x: this.#left + (this.#width / 2) * s, y: this.#top - PAD * s, align: 'center', scale: s},
      this.#style === 'panel-parchment' ? INK : GOLD,
    );

    // the quest wraps at the width of its scroll; the lines it has no room for are left out
    this.#questText.clear();
    if (this.#quest.width > 0) {
      const maxWidth = (this.#width - 2 * PAD - 18) * s;
      const {lineCount} = layoutText(this.#assets.font, QUEST, {maxWidth, scale: s});
      const room = Math.floor((questBottom - questTop - 14) / this.#assets.font.lineHeight);
      const text = lineCount <= room ? QUEST : this.#firstLines(QUEST, maxWidth, room);
      this.#questText.write(text, {x: this.#left + (PAD + 9) * s, y: this.#top - (questTop + 8) * s, maxWidth, scale: s}, INK);
    }

    // written when the inventory is open, see #placeInventory()
    this.#inventoryTitle.clear();
    this.#goldText.clear();
    this.#tooltipText.clear();
    this.#tooltipFor = -1;

    this.#writeDialog();
    this.#writeButton();
  }

  /** The words of `text` that fit into `lines` lines of `maxWidth`, measured with layoutText(). */
  #firstLines(text: string, maxWidth: number, lines: number): string {
    if (lines <= 0) return '';
    const words = text.split(' ');
    let fit = '';
    for (const word of words) {
      const next = fit === '' ? word : `${fit} ${word}`;
      if (layoutText(this.#assets.font, `${next}...`, {maxWidth, scale: this.#scale}).lineCount > lines) break;
      fit = next;
    }
    return `${fit}...`;
  }

  #writeButton(): void {
    const s = this.#scale;
    const b = this.#buttonRect;
    // the bevel of the pressed button is turned round: its label moves one pixel down
    const pressed = this.#buttonFrame === 'button-down' ? 1 : 0;
    this.#buttonText.write(
      'NEXT',
      {x: this.#left + (b.x + b.w / 2) * s, y: this.#top - (b.y + 4 + pressed) * s, align: 'center', scale: s},
      INK,
    );
    this.#buttonText.reveal(this.#dialogT >= 1 ? this.#buttonText.glyphs.length : 0);
  }

  #writeDialog(): void {
    const s = this.#scale;
    const d = this.#dialogRect;
    this.#dialogText.write(
      DIALOG[this.#line]!.text,
      {x: this.#left + (d.x + 56) * s, y: this.#top - (d.y + 11) * s, maxWidth: (d.w - 56 - 10) * s, scale: s},
      PAPER,
    );
    this.#dialogText.reveal(this.#dialogT >= 1 ? this.#typed : 0);
  }

  #placeBars(member: MemberCard): void {
    const {x, y} = member.rect;
    const hp = Math.max(1, Math.round((BAR_INNER * member.shownHp) / member.data.maxHp));
    const mp = Math.round((BAR_INNER * member.shownMp) / member.data.maxMp);
    // the fill is a nine-slice too, insets 0, 1, 0, 1: its light top row and dark bottom row
    // keep their pixel, its length stretches
    this.#placePanel(this.#back, member.hpFill, x + 52, y + 20, hp, 4);
    if (mp > 0) this.#placePanel(this.#back, member.mpFill, x + 52, y + 34, mp, 4);
    else this.#hide(this.#back, member.mpFill);
  }

  // ---------------------------------------------------------------- the inventory

  #animateInventory(dt: number): void {
    const before = this.#inventoryT;
    this.#inventoryT = clamp(this.#inventoryT + (this.#inventoryOpen ? dt : -dt) / OPEN_INVENTORY_SECONDS, 0, 1);
    if (before !== this.#inventoryT) this.#placeInventory();
    if (this.#inventoryT >= 1) this.#animateCursor(dt);
  }

  #placeInventory(): void {
    const t = this.#inventoryT;
    const r = this.#inventoryRect;
    const s = this.#scale;
    // opening overshoots and settles, closing falls in; the border keeps its size all the while
    const e = t <= 0 ? 0 : this.#inventoryOpen ? easeOutBack(t) : easeInCubic(t);
    if (t <= 0) {
      this.#hide(this.#back, this.#inventory);
    } else {
      // anchored at (1, 0): the position is the top right corner, the window grows to the left and down
      this.#placePanel(
        this.#back,
        this.#inventory,
        r.x + r.w,
        r.y,
        Math.max(16, Math.round(r.w * e)),
        Math.max(16, Math.round(r.h * e)),
      );
    }

    // a slot shows once the growing window holds it whole
    const left = r.x + r.w * (1 - e);
    const bottom = r.y + r.h * e;
    this.#slotRects.forEach((rect, i) => {
      const slot = this.#slots[i]!;
      const icon = this.#items[i];
      if (t > 0 && rect.x >= left + 4 && rect.y + rect.h <= bottom - 4) {
        this.#placePanel(this.#back, slot, rect.x, rect.y, rect.w, rect.h);
        if (icon != null) {
          // a TexturedSprite is placed by its middle
          icon.setPosition(this.#left + (rect.x + rect.w / 2) * s, this.#top - (rect.y + rect.h / 2) * s);
          icon.setSize(12 * s, 12 * s);
          this.#icons.spritePool?.touchVO(icon);
        }
      } else {
        this.#hide(this.#back, slot);
        if (icon != null) this.#hide(this.#icons, icon);
      }
    });

    const open = t >= 1;
    if (open && this.#inventoryTitle.glyphs.length === 0) {
      const color = this.#style === 'panel-parchment' ? INK : GOLD;
      this.#inventoryTitle.write(
        'INVENTORY',
        {x: this.#left + (r.x + r.w / 2) * s, y: this.#top - (r.y + 10) * s, align: 'center', scale: s},
        color,
      );
      this.#goldText.write('GOLD 1337', {x: this.#left + (r.x + 10) * s, y: this.#top - (r.y + r.h - 18) * s, scale: s}, color);
      const slot = this.#slotRects[this.#selected]!;
      this.#cursorX = slot.x + SLOT / 2;
      this.#cursorY = slot.y + SLOT / 2;
    } else if (!open) {
      this.#inventoryTitle.clear();
      this.#goldText.clear();
      this.#tooltipText.clear();
      this.#tooltipFor = -1;
      this.#tooltipW = 0;
      this.#hide(this.#front, this.#cursor);
      this.#hide(this.#front, this.#tooltip);
    }
  }

  #animateCursor(dt: number): void {
    // without the pointer over the bag the cursor walks through the items on its own
    this.#autoSelect += dt;
    if (this.#time - this.#pointerOverSlotAt > 4 && this.#autoSelect > 1.6) {
      this.#autoSelect = 0;
      do {
        this.#selected = (this.#selected + 1) % INVENTORY.length;
      } while (INVENTORY[this.#selected] == null);
    }
    const slot = this.#slotRects[this.#selected]!;
    const targetX = slot.x + SLOT / 2;
    const targetY = slot.y + SLOT / 2;
    this.#cursorX = approach(this.#cursorX, targetX, 18, dt);
    this.#cursorY = approach(this.#cursorY, targetY, 18, dt);
    const cx = Math.round(this.#cursorX);
    const cy = Math.round(this.#cursorY);
    // the gold frame of the portraits, stretched around a slot and anchored in its middle
    this.#placePanel(this.#front, this.#cursor, cx, cy, SLOT + 6, SLOT + 6);

    // the tooltip is as wide as its text — measured with layoutText() — and grows or shrinks to the next
    const item = INVENTORY[this.#selected]!;
    const width = layoutText(this.#assets.font, item.name).width + 10;
    if (this.#tooltipFor !== this.#selected) {
      this.#tooltipFor = this.#selected;
      this.#tooltipText.clear();
    }
    this.#tooltipW = this.#tooltipW === 0 ? width : approach(this.#tooltipW, width, 20, dt);
    const tw = Math.round(this.#tooltipW);
    // anchored at its top middle under the slot, above it in the last row, inside the main window
    const lastRow = this.#selected >= (INVENTORY_ROWS - 1) * INVENTORY_COLUMNS;
    const tx = Math.round(clamp(cx, PAD + tw / 2, this.#width - PAD - tw / 2));
    const ty = lastRow ? cy - SLOT / 2 - 3 - 14 : cy + SLOT / 2 + 3;
    this.#placePanel(this.#front, this.#tooltip, tx, ty, tw, 14);

    // its text follows once the cursor and the panel have settled
    const settled = tw === width && cx === targetX && cy === targetY;
    if (settled && this.#tooltipText.glyphs.length === 0) {
      const s = this.#scale;
      this.#tooltipText.write(
        item.name,
        {x: this.#left + tx * s, y: this.#top - (ty + 3) * s, align: 'center', scale: s},
        TOOLTIP_TEXT,
      );
    } else if (!settled && this.#tooltipText.glyphs.length > 0) {
      this.#tooltipText.clear();
    }
  }

  // ---------------------------------------------------------------- the dialog

  #animateDialog(dt: number): void {
    if (this.#dialogT < 1) {
      this.#dialogT = clamp(this.#dialogT + dt / OPEN_DIALOG_SECONDS, 0, 1);
      this.#placeDialog();
      return;
    }

    const total = this.#dialogText.glyphs.length;
    if (this.#typed < total) {
      this.#typed = Math.min(total, this.#typed + dt * TYPE_SPEED);
      this.#dialogText.reveal(this.#typed);
      this.#lineDone = 0;
    } else {
      this.#lineDone += dt;
      if (!this.#composed && this.#lineDone > 0.3) {
        this.#composed = true;
        this.onComposed?.();
      }
      if (this.#lineDone > LINE_PAUSE) this.#next();
    }

    // the button: pressed while held, lit under the pointer, and blinking once the line is out
    const waiting = this.#typed >= total && Math.floor(this.#lineDone * 2) % 2 === 1;
    const frame =
      this.#buttonDown && this.#buttonHover ? 'button-down' : this.#buttonHover || waiting ? 'button-hover' : 'button-up';
    if (frame !== this.#buttonFrame) {
      const pressedBefore = this.#buttonFrame === 'button-down';
      this.#buttonFrame = frame;
      this.#button.setSliceFrame(this.#kitFrame, frame);
      this.#back.spritePool?.touchVO(this.#button, 'texCoords');
      if (pressedBefore !== (frame === 'button-down')) this.#writeButton();
    }

    // the name plate grows or shrinks to the name of the next speaker
    const target = (this.#speaker?.frames?.name.coords.width ?? 0) + 8;
    if (this.#namePlateW !== target) {
      this.#namePlateW = Math.abs(this.#namePlateW - target) < 0.5 ? target : approach(this.#namePlateW, target, 14, dt);
      this.#placeNamePlate();
    }
  }

  /** The next line, or the rest of this one at once. */
  #next(): void {
    const total = this.#dialogText.glyphs.length;
    if (this.#typed < total) {
      this.#typed = total;
      this.#dialogText.reveal(total);
      return;
    }
    this.#line = (this.#line + 1) % DIALOG.length;
    this.#typed = 0;
    this.#lineDone = 0;
    this.#showSpeaker();
    this.#writeDialog();
    if (this.#dialogT >= 1) this.#placeDialog();
  }

  #showSpeaker(): void {
    const speaker = this.#members.find(({data}) => data.id === DIALOG[this.#line]!.speaker)!;
    this.#speaker = speaker;
    if (speaker.frames == null) return;
    // the frames of the speaker's card: the atlas holds every portrait and name once
    this.#speakerPortrait.setFrame(speaker.frames.portrait);
    this.#speakerName.setFrame(speaker.frames.name);
    if (this.#namePlateW === 0) this.#namePlateW = speaker.frames.name.coords.width + 8;
  }

  #placeDialog(): void {
    const d = this.#dialogRect;
    const t = this.#dialogT;
    if (t <= 0) {
      this.#hide(this.#back, this.#dialog);
    } else {
      // anchored at (0, 1): the position is the bottom left corner, the box grows upwards
      this.#placePanel(this.#back, this.#dialog, d.x, d.y + d.h, d.w, Math.max(12, Math.round(d.h * easeOutBack(t))));
    }
    if (t >= 1) {
      this.#placePanel(this.#back, this.#speakerBackdrop, d.x + 8, d.y + 13, 40, 40);
      this.#placePanel(this.#back, this.#speakerFrame, d.x + 8, d.y + 13, 40, 40);
      this.#placePanel(this.#back, this.#button, this.#buttonRect.x, this.#buttonRect.y, BUTTON_W, BUTTON_H);
      this.#placePicture(this.#speakerPortrait, this.#speaker?.frames?.portrait, d.x + 14, d.y + 19, 1);
      this.#placeNamePlate();
      this.#buttonText.reveal(this.#buttonText.glyphs.length);
    } else {
      for (const panel of [this.#speakerBackdrop, this.#speakerFrame, this.#button, this.#namePlate])
        this.#hide(this.#back, panel);
      this.#hide(this.#pictures, this.#speakerPortrait);
      this.#hide(this.#pictures, this.#speakerName);
    }
  }

  #placeNamePlate(): void {
    if (this.#dialogT < 1) return;
    const d = this.#dialogRect;
    // on the top edge of the dialog box, the name in it
    this.#placePanel(this.#back, this.#namePlate, d.x + 8, d.y - 7, Math.round(this.#namePlateW), 14);
    this.#placePicture(this.#speakerName, this.#speaker?.frames?.name, d.x + 12, d.y - 4, this.#scale);
  }

  // ---------------------------------------------------------------- the party

  #animateParty(dt: number): void {
    this.#combat += dt;
    if (this.#combat > COMBAT_TICK) {
      this.#combat = 0;
      this.#combatRound();
    }
    for (const member of this.#members) {
      if (member.shownHp !== member.hp || member.shownMp !== member.mp) {
        member.shownHp = Math.abs(member.shownHp - member.hp) < 0.05 ? member.hp : approach(member.shownHp, member.hp, 5, dt);
        member.shownMp = Math.abs(member.shownMp - member.mp) < 0.05 ? member.mp : approach(member.shownMp, member.mp, 5, dt);
        this.#placeBars(member);
      }
      // the counters are drawn anew in place: their frames stay where they are, their sprites untouched
      const hpText = this.#hpText(member);
      if (hpText !== member.drawnHp) {
        member.drawnHp = hpText;
        this.#atlas.redraw(`hp:${member.data.id}`, this.#labels.draw(hpText, this.#hpColor(member)));
      }
      const mpText = this.#mpText(member);
      if (mpText !== member.drawnMp) {
        member.drawnMp = mpText;
        this.#atlas.redraw(`mp:${member.data.id}`, this.#labels.draw(mpText, '#9ec8ff'));
      }
      if (member.flash > 0) {
        member.flash = Math.max(0, member.flash - dt * 2.5);
        const {r, g, b} = member.flashColor;
        // flash is a dynamic attribute: every update() uploads it, nothing to mark
        member.portrait.setFlash(r, g, b, member.flash * 0.8);
      }
    }
  }

  #combatRound(): void {
    const roll = Math.random();
    const member = this.#members[Math.floor(Math.random() * this.#members.length)]!;
    // the most wounded drinks a potion once it is down to half
    const wounded = this.#members.reduce((a, b) => (b.hp / b.data.maxHp < a.hp / a.data.maxHp ? b : a));
    if (roll < 0.3 && wounded.hp / wounded.data.maxHp < 0.5) {
      wounded.hp = Math.min(wounded.data.maxHp, wounded.hp + Math.ceil(wounded.data.maxHp * 0.4));
      wounded.flash = 0.7;
      wounded.flashColor.set('#7dff9a');
    } else if (roll < 0.75) {
      this.#damage(member, 2 + Math.floor(Math.random() * member.data.maxHp * 0.2));
    } else {
      // a spell, or a mana tonic once the spell costs more than is left
      const cost = 2 + Math.floor(Math.random() * 6);
      member.mp = member.mp >= cost ? member.mp - cost : member.data.maxMp;
    }
  }

  #damage(member: MemberCard, amount: number): void {
    member.hp = Math.max(1, member.hp - amount);
    member.flash = 1;
    member.flashColor.set('#ff3a2a');
  }

  #hpText(member: MemberCard): string {
    return `${Math.round(member.shownHp)}/${member.data.maxHp}`;
  }

  #mpText(member: MemberCard): string {
    return `${Math.round(member.shownMp)}/${member.data.maxMp}`;
  }

  #hpColor(member: MemberCard): string {
    return Math.round(member.shownHp) / member.data.maxHp < 0.3 ? '#ff6a5a' : '#f2e6c6';
  }
}
