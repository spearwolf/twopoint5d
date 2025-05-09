import {emit, on, retain} from '@spearwolf/eventize';
import {batch, createEffect, findObjectSignalByName} from '@spearwolf/signalize';
import {signal} from '@spearwolf/signalize/decorators';
import {
  TextureAtlas,
  TexturedSprites,
  TexturedSpritesGeometry,
  type Stage2D,
  type TexturedSpritePool,
  type TextureStore,
} from '@spearwolf/twopoint5d';
import {StageRenderFrame, type StageRenderFrameProps} from '@spearwolf/twopoint5d/events.js';
import {AdditiveBlending, Color, Group, Vector2, Vector3, type Scene} from 'three';
import {StarMaterial} from './StarMaterial.js';

export const OnMaterial = 'material';

export interface OnMaterialParams {
  starfield: Starfield;
  material: StarMaterial;
}

const rand = (max: number) => (Math.random() * max) | 0;

export class Starfield {
  readonly textureStore: TextureStore;
  readonly stage: Stage2D;
  readonly geometry: TexturedSpritesGeometry;

  @signal() accessor atlasName: string;
  @signal() accessor atlas: TextureAtlas;
  @signal() accessor material: StarMaterial;
  @signal() accessor sprites: TexturedSprites;

  get scene(): Scene {
    return this.stage.scene;
  }

  get pool(): TexturedSpritePool {
    return this.geometry.instancedPool;
  }

  origin = new Group();

  starBox = new Vector3(1, 1, 1);
  starSize = 0.01;
  starSpeed = 1;

  rotationSpeed = 0;

  #screenResolution: [number, number] = [0, 0];
  #minMaxSizeScale: [number, number] = [1, 1];
  #nearFar: Vector2 = new Vector2(0, 1);
  #cameraLineOfSightEscape = 2;
  #baseColors: Color[];

  constructor(textureStore: TextureStore, stage: Stage2D, capacity: number, atlasName: string) {
    retain(this, OnMaterial);

    this.textureStore = textureStore;

    this.stage = stage;
    this.scene.add(this.origin);

    this.setBaseColors([0xffffff]);

    this.geometry = new TexturedSpritesGeometry(capacity);

    createEffect(() => this.#loadAtlas(), [findObjectSignalByName(this, 'atlasName')]);
    createEffect(() => this.#appendSpritesToStage(), [findObjectSignalByName(this, 'sprites')]);
    createEffect(() => this.#createSprites(), [findObjectSignalByName(this, 'sprites'), findObjectSignalByName(this, 'atlas')]);

    this.atlasName = atlasName;

    on(this.stage, StageRenderFrame, ({deltaTime}: StageRenderFrameProps) => {
      if (this.sprites) {
        this.animateStars(deltaTime);
        this.sprites.update();
      }
    });
  }

  setBaseColors(colors: (Color | number | string)[]) {
    this.#baseColors = colors.map((color) => new Color(color));
  }

  randomBaseColor(): Color {
    return this.#baseColors[rand(this.#baseColors.length)];
  }

  setStarBox(width: number, height: number, depth: number = this.starBox.z) {
    this.starBox.set(width, height, depth);
  }

  setStarBoxCenter(x: number, y: number, z: number) {
    this.origin.position.set(-x, -y, -z);
  }

  createStars(count: number) {
    const {pool} = this;

    if (pool.usedCount + count > pool.capacity) {
      count = pool.capacity - pool.usedCount;
    }

    if (count <= 0) return;

    for (let i = 0; i < count; i++) {
      const frame = this.atlas.randomFrame();
      const starHeight = (frame.coords.height / frame.coords.width) * (this.starSize / frame.coords.width) * frame.coords.height;

      const vo = pool.createVO();

      vo.setFrame(frame);
      vo.setSize(this.starSize, starHeight);
      vo.setPosition(this.starBox.x * Math.random(), this.starBox.y * Math.random(), this.starBox.z * Math.random());
      vo.setColor(this.randomBaseColor());
    }
  }

  setScreenResolution(width: number, height: number) {
    this.#screenResolution = [width, height];
    if (this.material != null) {
      this.material.screenResolution = this.#screenResolution;
    }
  }

  setMinMaxSizeScale(minSizeScale: number, maxSizeScale: number) {
    this.#minMaxSizeScale = [minSizeScale, maxSizeScale];
    if (this.material != null) {
      this.material.minMaxSizeScale = this.#minMaxSizeScale;
    }
  }

  get minSizeScale(): number {
    return this.#minMaxSizeScale[0];
  }

  get maxSizeScale(): number {
    return this.#minMaxSizeScale[1];
  }

  set minSizeScale(value: number) {
    this.setMinMaxSizeScale(value, this.maxSizeScale);
  }

  set maxSizeScale(value: number) {
    this.setMinMaxSizeScale(this.minSizeScale, value);
  }

  setNearFar(near: number, far: number) {
    this.#nearFar.set(near, far);
    if (this.material != null) {
      this.material.nearFar = this.#nearFar;
    }
  }

  get cameraLineOfSightEscape(): number {
    return this.#cameraLineOfSightEscape;
  }

  set cameraLineOfSightEscape(value: number) {
    this.#cameraLineOfSightEscape = value;
    if (this.material != null) {
      this.material.cameraLineOfSightEscape = this.#cameraLineOfSightEscape;
    }
  }

  rotateStars(calcFn: (rotation: number) => number) {
    this.material.rotZ = calcFn(this.material.rotZ) % (Math.PI * 2);
  }

  animateStars(deltaTime: number, speed = this.starSpeed) {
    this.rotateStars((rot) => rot + deltaTime * this.rotationSpeed);

    for (let i = 0; i < this.pool.usedCount; i++) {
      const vo = this.pool.getVO(i);

      vo.z += deltaTime * speed;

      if (vo.z < 0) {
        vo.z += this.starBox.z;
      } else if (vo.z > this.starBox.z) {
        vo.z -= this.starBox.z;
      }
    }

    this.geometry.touchAttributes('position');
  }

  #onCreateMaterial(material: StarMaterial) {
    material.screenResolution = this.#screenResolution;
    material.minMaxSizeScale = this.#minMaxSizeScale;
    material.nearFar = this.#nearFar;
    material.cameraLineOfSightEscape = this.#cameraLineOfSightEscape;
  }

  #loadAtlas() {
    return this.textureStore.get(this.atlasName, ['atlas', 'texture'], ([atlas, texture]) => {
      batch(() => {
        this.atlas = atlas;
        if (this.material != null || this.material?.colorMap != texture) {
          this.material?.dispose();
          this.material = new StarMaterial({
            colorMap: texture,
            depthTest: false,
            depthWrite: false,
            blending: AdditiveBlending,
          });
          this.#onCreateMaterial(this.material);
          emit(this, OnMaterial, {starfield: this, material: this.material} as OnMaterialParams);
        }
        if (this.sprites == null) {
          this.sprites = new TexturedSprites(this.geometry, this.material);
        }
        this.sprites.material = this.material;
      });
    });
  }

  #appendSpritesToStage() {
    const {origin, sprites} = this;
    if (sprites) {
      origin.add(sprites);
      return () => {
        origin.remove(sprites);
      };
    }
  }

  #createSprites() {
    if (this.atlas && this.sprites) {
      this.createStars(this.pool.availableCount);
    }
  }
}
