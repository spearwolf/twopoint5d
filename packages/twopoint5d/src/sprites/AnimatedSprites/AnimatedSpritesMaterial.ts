import { createEffect, createSignal } from '@spearwolf/signalize';
import { add, attribute, div, mod, mul, texture, uniform, vec2, vec4 } from 'three/tsl';
import { type Texture } from 'three/webgpu';
import { TexturedSpritesMaterial, type TexturedSpritesMaterialParameters } from '../TexturedSprites/TexturedSpritesMaterial.js';
import { texCoordsFromIndex } from '../node-utils.js';

export interface AnimatedSpritesMaterialParameters extends TexturedSpritesMaterialParameters {
  animsMap?: Texture;
  time?: number;
}

export class AnimatedSpritesMaterial extends TexturedSpritesMaterial {
  static readonly AnimAttributeName = 'anim';

  #animsMap = createSignal<Texture | undefined>(undefined, {attach: this});

  get animsMap(): Texture | undefined {
    return this.#animsMap.get();
  }

  /**
   * Sets the animsMap texture. Plain assignment does not re-read the texture's image — an
   * assignment of the same texture instance is a no-op to the underlying signal. Call
   * {@link touchAnimsMap} once a texture assigned here has finished loading.
   */
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
        const animsImage = this.animsMap?.image as {width?: number; height?: number} | null | undefined;

        if (animsImage != null && animsImage.width > 0 && animsImage.height > 0) {
          const animsMapSize = vec2(animsImage.width, animsImage.height);

          const time = this.#timeUniform;

          const anim = attribute<'vec2'>(AnimatedSpritesMaterial.AnimAttributeName);
          const animId = anim.x;
          const animOffset = anim.y;

          const animMetaData = texture(this.animsMap, texCoordsFromIndex(animsMapSize, animId.toInt()));
          const frameIndex = mod(mul(div(add(time, animOffset), animMetaData.y), animMetaData.x), animMetaData.x)
            .floor()
            .toInt();
          this.texCoordsNode = texture(
            this.animsMap,
            texCoordsFromIndex(animsMapSize, add(animMetaData.z.toInt(), frameIndex).toInt()),
          );
        } else {
          this.texCoordsNode = vec4(0, 0, 1, 1);
        }

        this.needsUpdate = true;
      },
      {attach: this},
    );
  }

  /**
   * Re-reads the animsMap texture and rebuilds the animation lookup from its current image.
   * `TextureLoader` writes the loaded image into the same texture instance without emitting
   * an event, so a texture assigned before it finished loading needs this call once it has.
   */
  touchAnimsMap(): void {
    this.#animsMap.touch();
  }

  override dispose(): void {
    this.#animsMap.value?.dispose();
    this.#animsMap.set(undefined);
    this.#animsMap.destroy();
    super.dispose();
  }
}
