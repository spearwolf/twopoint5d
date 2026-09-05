import {createEffect, createSignal} from '@spearwolf/signalize';
import {add, attribute, div, mod, mul, texture, uniform, vec2, vec4} from 'three/tsl';
import {type Texture} from 'three/webgpu';
import {TexturedSpritesMaterial, type TexturedSpritesMaterialParameters} from '../TexturedSprites/TexturedSpritesMaterial.js';
import {texCoordsFromIndex} from '../node-utils.js';

export interface AnimatedSpritesMaterialParameters extends TexturedSpritesMaterialParameters {
  animsMap?: Texture;
  time?: number;
}

export class AnimatedSpritesMaterial extends TexturedSpritesMaterial {
  static readonly AnimAttributeName = 'anim';

  #animsMap = createSignal<Texture | undefined>(undefined, {attach: this});

  /** The animation lookup texture — `undefined` once the material has been disposed. */
  get animsMap(): Texture | undefined {
    return this.#animsMap.get();
  }

  /**
   * Sets the animsMap texture. Plain assignment does not re-read the texture's image — an
   * assignment of the same texture instance is a no-op to the underlying signal. Call
   * {@link touchAnimsMap} once a texture assigned here has finished loading.
   *
   * The texture stays the caller's; {@link dispose} does not release it.
   */
  set animsMap(value: Texture | undefined) {
    this.#animsMap.set(value);
  }

  #timeUniform = uniform(0);

  /**
   * The animation time, in seconds. Backed by a shader uniform rather than a signal: reads and
   * writes keep working once the material has been disposed, they just reach nothing that still
   * renders.
   */
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

        // a texture whose image has not loaded yet carries no dimensions; the neutral
        // coordinates below hold until touchAnimsMap() picks the loaded image up
        const width = animsImage?.width;
        const height = animsImage?.height;

        if (width != null && width > 0 && height != null && height > 0) {
          const animsMapSize = vec2(width, height);

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
   *
   * A silent no-op on a disposed material. On a live material without an animsMap it is not:
   * the call rebuilds the neutral texture coordinates and sets `needsUpdate`, which can make
   * three.js drop the render object and generate the shader source for it again on the next
   * frame. That source comes out unchanged, so the shader program and the render pipeline
   * come back out of the renderer's caches and nothing is compiled. Call it when a texture
   * has loaded, not once per frame.
   */
  touchAnimsMap(): void {
    this.#animsMap.touch();
  }

  /**
   * Gives up the animsMap texture. It was handed in and belongs to the caller, so it is not
   * released here. Afterwards {@link animsMap} answers `undefined`. A second call does nothing.
   */
  override dispose(): void {
    // the animsMap texture was handed in and stays the caller's; the reference is cleared
    // here, before super.dispose() tears the signal group down, so the getter answers
    // undefined without a write to an already destroyed signal
    this.#animsMap.set(undefined);
    super.dispose();
  }
}
