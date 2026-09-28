import {batch, createEffect, createMemo, createSignal, type Effect} from '@spearwolf/signalize';
import {add, attribute, div, float, int, max, mod, mul, select, texture, uniform, vec4} from 'three/tsl';
import {type Texture, Vector2} from 'three/webgpu';
import {TexturedSpritesMaterial, type TexturedSpritesMaterialParameters} from '../TexturedSprites/TexturedSpritesMaterial.js';
import {texCoordsFromIndex} from '../node-utils.js';
import {textureShapeKey} from '../textureShapeKey.js';

type AnimsImage = {width?: number; height?: number} | null | undefined;

// the measures of the image of an animsMap, while it has one: a texture whose image has not
// loaded yet carries none
const loadedImageOf = (animsMap: Texture | undefined): {width: number; height: number} | undefined => {
  const image = animsMap?.image as AnimsImage;
  const width = image?.width;
  const height = image?.height;
  return width != null && width > 0 && height != null && height > 0 ? {width, height} : undefined;
};

/**
 * The options of an {@link AnimatedSpritesMaterial}: those of a
 * {@link TexturedSpritesMaterialParameters} plus the animation lookup and its start time. Every
 * three.js material parameter among them reaches the material through `setValues()`, and
 * without an `alphaTest` or `alphaTestNode` the material drops every texel with an alpha of
 * `0.001` or less.
 */
export interface AnimatedSpritesMaterialParameters extends TexturedSpritesMaterialParameters {
  /** The animation lookup texture. It stays the caller's; {@link AnimatedSpritesMaterial.dispose} does not release it. */
  animsMap?: Texture;
  /** The animation time the material starts at, in seconds. Default is `0`. */
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
   * A loaded animsMap of the same kind as the one set takes its place without a rebuild: the texture
   * nodes of the lookups get it as their value, and its measures go into a uniform. Of the same kind
   * means what {@link TexturedSpritesMaterial.colorMap} tells for the color map — alike in
   * `colorSpace`, `type`, `format`, the way three binds it, the two filter tests, `compareFunction`
   * and the samples of its render target. A texture of another kind, and a change between an
   * animsMap with an image and none, builds the lookups and the graphs of the base class anew and
   * sets `needsUpdate`; three then generates the shader source again, takes program and pipeline out
   * of its caches for a source it has built before and compiles one it has not.
   *
   * The texture stays the caller's; {@link dispose} does not release it.
   */
  set animsMap(value: Texture | undefined) {
    this.#animsMap.set(value);
  }

  #timeUniform = uniform(0);

  // the measures of the image of the animsMap, which the lookups turn a texel index into
  // coordinates by
  #animsMapSize = uniform(new Vector2(0, 0));

  // what the lookups depend on of the animsMap: its kind, and whether it has an image yet. A
  // texture of the same kind that has one yields the same key, and the memo notifies nobody
  #animsMapShape = createMemo(
    () => {
      const animsMap = this.#animsMap.get();
      return loadedImageOf(animsMap) != null ? textureShapeKey(animsMap) : undefined;
    },
    {attach: this},
  );

  // the header, the frame, the flip and the trim lookup of the graph, while there is one
  #animsTextureNodes: ReturnType<typeof texture>[] = [];

  readonly #texCoordsEffect: Effect;

  readonly #animsMapValueEffect: Effect;

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
    // animsMap and time belong to this class; left in the options of the base class they would
    // reach the accessors below through setValues() before their private fields exist
    const {animsMap, time, ...texturedSpritesOptions} = options ?? {};

    super(texturedSpritesOptions);

    if (time != null) this.time = time;

    this.animsMap = animsMap;

    this.#texCoordsEffect = createEffect(
      () => {
        // the graph follows the kind of the animsMap and whether it has an image, not the texture
        // itself: the texture is read untracked here, and #animsMapValueEffect hands a new one of the
        // same kind and its measures to the nodes. Until the image has loaded the neutral coordinates
        // below hold, and touchAnimsMap() picks the loaded image up
        if (this.#animsMapShape() !== undefined) {
          const animsMap = this.#animsMap.value!;
          const {width, height} = loadedImageOf(animsMap)!;
          this.#animsMapSize.value.set(width, height);
          const animsMapSize = this.#animsMapSize;

          const time = this.#timeUniform;

          const anim = attribute<'vec2'>(AnimatedSpritesMaterial.AnimAttributeName);
          const animId = anim.x;
          const animOffset = anim.y;

          // the header texel of an animation: [frameCount, duration, first frame texel, texelsPerFrame]
          const animMetaData = texture(animsMap, texCoordsFromIndex(animsMapSize, animId.toInt()));
          // a duration of 0 is a still image, its first frame, and the division by it drops out.
          // Both branches are ints already: a select() converted to an int afterwards comes out of
          // the WGSL builder as a float in one of the places it is read, and the shader fails to compile
          const frameIndex = select(
            animMetaData.y.greaterThan(0),
            mod(mul(div(add(time, animOffset), animMetaData.y), animMetaData.x), animMetaData.x)
              .floor()
              .toInt(),
            int(0),
          );

          // an animsMap built by hand with a 0 in the last field of the header reads as one texel
          // per frame, the layout it was written for
          const texelsPerFrame = max(animMetaData.w, float(1));
          const frameTexel = add(animMetaData.z.toInt(), mul(frameIndex, texelsPerFrame.toInt())).toInt();

          const texCoordsNode = texture(animsMap, texCoordsFromIndex(animsMapSize, frameTexel));

          // the second texel of a frame is [width, height, flipDiagonal, 0]; a frame of one texel
          // is never turned
          const flipLookup = texture(animsMap, texCoordsFromIndex(animsMapSize, add(frameTexel, 1).toInt()));
          const texFlipDiagonalNode = select(texelsPerFrame.greaterThan(1.5), flipLookup.z, float(0));

          // the third texel of a frame is [left, top, right, bottom]; a frame of one or two texels
          // is untrimmed
          const trimLookup = texture(animsMap, texCoordsFromIndex(animsMapSize, add(frameTexel, 2).toInt()));
          const texTrimNode = select(texelsPerFrame.greaterThan(2.5), trimLookup, vec4(0, 0, 0, 0));

          this.#animsTextureNodes = [animMetaData, texCoordsNode, flipLookup, trimLookup];

          // one batch, so that the effects of the base class — color and position — build once
          // each for these writes
          batch(() => {
            this.texCoordsNode = texCoordsNode;
            this.texFlipDiagonalNode = texFlipDiagonalNode;
            this.texTrimNode = texTrimNode;
          });
        } else {
          this.#animsTextureNodes = [];

          batch(() => {
            this.texCoordsNode = vec4(0, 0, 1, 1);
            this.texFlipDiagonalNode = float(0);
            this.texTrimNode = vec4(0, 0, 0, 0);
          });
        }

        this.needsUpdate = true;
      },
      {attach: this},
    );

    // three reads the value of a texture node and of a uniform at run time, so this takes no
    // needsUpdate. It runs on every animsMap write and on touchAnimsMap(); on a change of the key the
    // effect above builds new nodes as well, and whichever of the two runs first, both end with the
    // new texture and its measures in the nodes
    this.#animsMapValueEffect = createEffect(
      () => {
        const animsMap = this.#animsMap.get();
        const image = loadedImageOf(animsMap);
        if (animsMap == null || image == null) return;

        this.#animsMapSize.value.set(image.width, image.height);
        for (const node of this.#animsTextureNodes) {
          node.value = animsMap;
        }
      },
      {attach: this},
    );
  }

  /**
   * Re-reads the animsMap texture. `TextureLoader` writes the loaded image into the same texture
   * instance without emitting an event, so a texture assigned before it finished loading needs this
   * call once it has.
   *
   * The call builds the animation lookup anew only when the texture has got its first image since
   * it was last read, or has changed its kind (see {@link animsMap}). Then it sets `needsUpdate`, and
   * three generates the shader source again on the next frame; it takes the shader program and the
   * render pipeline out of its caches for a source it has built before, and compiles one it has not.
   * Otherwise the call takes the measures of the current image into the uniform the lookups read,
   * and builds nothing. Call it when a texture has loaded, not once per frame.
   *
   * On a live material without an animsMap, and on a disposed material, it does nothing.
   */
  touchAnimsMap(): void {
    this.#animsMap.touch();
  }

  /**
   * Gives up the animsMap texture. It was handed in and belongs to the caller, so it is not
   * released here. Afterwards {@link animsMap} answers `undefined`. A second call does nothing.
   */
  override dispose(): void {
    // the own effects go before the write below, which would run them and, through
    // texCoordsNode, texFlipDiagonalNode and texTrimNode, the color and the position effect of the
    // base class as well
    this.#texCoordsEffect.destroy();
    this.#animsMapValueEffect.destroy();

    // the animsMap texture was handed in and stays the caller's; the reference is cleared
    // here, before super.dispose() tears the signal group down, so the getter answers
    // undefined without a write to an already destroyed signal
    this.#animsMap.set(undefined);
    super.dispose();
  }
}
