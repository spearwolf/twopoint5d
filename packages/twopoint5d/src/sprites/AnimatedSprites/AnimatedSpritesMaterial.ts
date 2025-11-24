import {createEffect, createSignal} from '@spearwolf/signalize';
import {add, attribute, div, mod, mul, texture, uniform, vec2, vec4} from 'three/tsl';
import {Texture} from 'three/webgpu';
import {TexturedSpritesMaterial, type TexturedSpritesMaterialParameters} from '../TexturedSprites/TexturedSpritesMaterial.js';
import {texCoordsFromIndex} from '../node-utils.js';

interface AnimatedSpritesMaterialParameters extends TexturedSpritesMaterialParameters {
  animsMap?: Texture;
  time?: number;
}

export class AnimatedSpritesMaterial extends TexturedSpritesMaterial {
  static readonly AnimAttributeName = 'anim';

  #animsMap = createSignal<Texture | undefined>(undefined, {attach: this});

  get animsMap(): Texture | undefined {
    return this.#animsMap.get();
  }

  set animsMap(value: Texture | undefined) {
    this.#animsMap.set(value);
  }

  #timeUniform = uniform(0);

  set time(value: number) {
    this.#timeUniform.value = value;
  }

  get time(): number {
    return this.#timeUniform.value;
  }

  constructor(options?: AnimatedSpritesMaterialParameters) {
    super(options);

    this.animsMap = options?.animsMap;

    createEffect(
      () => {
        if (this.animsMap) {
          const animsTexture = this.animsMap.image as Texture;
          const animsMapSize = vec2(animsTexture.width, animsTexture.height);

          const time = this.#timeUniform;

          const anim = attribute(AnimatedSpritesMaterial.AnimAttributeName);
          const animId = anim[0];
          const animOffset = anim[1];

          const animMetaData = texture(this.animsMap, texCoordsFromIndex(animsMapSize, animId.toInt()));
          const frameIndex = mod(mul(div(add(time, animOffset), animMetaData.y), animMetaData.x), animMetaData.x)
            .floor()
            .toInt();
          this.texCoordsNode = texture(this.animsMap, texCoordsFromIndex(animsMapSize, add(animMetaData.z.toInt(), frameIndex)));
        } else {
          this.texCoordsNode = vec4(0, 0, 1, 1);
        }

        this.needsUpdate = true;
      },
      {attach: this},
    );
  }

  override dispose(): void {
    super.dispose();
    this.#animsMap.value?.dispose();
    this.#animsMap.set(undefined);
    this.#animsMap.destroy();
  }
}
