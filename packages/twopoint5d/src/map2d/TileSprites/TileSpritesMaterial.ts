import {createEffect, createMemo, createSignal, type Effect, SignalGroup} from '@spearwolf/signalize';
import {attribute, float, vec3, vec4} from 'three/tsl';
import {type Node, NodeMaterial, type Texture} from 'three/webgpu';
import {colorFromTextureByTexCoords, vertexByInstancePosition} from '../../sprites/node-utils.js';
import {textureShapeKey} from '../../sprites/textureShapeKey.js';

export interface TileSpritesMaterialParameters {
  name?: string;
  colorMap?: Texture;
}

const createShaderAttributeNodeSignal = <T = unknown>(name: string, attach: object) =>
  createSignal<Node<T>>(attribute<T>(name), {attach});

export class TileSpritesMaterial extends NodeMaterial {
  static readonly PositionAttributeName = 'position';
  static readonly InstancePositionAttributeName = 'instancePosition';
  static readonly QuadSizeAttributeName = 'quadSize';
  static readonly TexFlipDiagonalAttributeName = 'texFlipDiagonal';

  static readonly DefaultColor = vec4(0.5, 0.5, 0.5, 1); // Default color if no texture is provided

  #vertexPositionNode = createShaderAttributeNodeSignal<'vec3'>(TileSpritesMaterial.PositionAttributeName, this);
  #instancePositionNode = createShaderAttributeNodeSignal<'vec3'>(TileSpritesMaterial.InstancePositionAttributeName, this);
  #quadSizeNode = createShaderAttributeNodeSignal<'vec2'>(TileSpritesMaterial.QuadSizeAttributeName, this);

  #colorMap = createSignal<Texture | undefined>(undefined, {attach: this});

  // what the color graph depends on of the color map: a new texture of the same kind yields the same
  // key, and the memo notifies nobody
  #colorMapShape = createMemo(() => textureShapeKey(this.#colorMap.get()), {attach: this});

  // the node that samples the color map, while there is one
  #colorTextureNode: ReturnType<typeof colorFromTextureByTexCoords> | undefined;

  readonly #positionEffect: Effect;

  readonly #colorEffect: Effect;

  readonly #colorMapValueEffect: Effect;

  /** The color map texture — `undefined` once the material has been disposed. */
  get colorMap(): Texture | undefined {
    return this.#colorMap.get();
  }

  /**
   * Sets the color map texture. The texture stays the caller's; {@link dispose} does not release it.
   *
   * A texture of the same kind as the one set takes its place without a rebuild: the texture node of
   * the color graph just gets it as its value. Of the same kind means alike in `colorSpace`, `type`
   * and `format`, in the way three binds it — a cube, array, 3d, depth, storage, video or compressed
   * texture each binds in a way of its own, a `DataTexture` binds as a `Texture` does —, in whether
   * both filters are `NearestFilter`, in whether a filter blends texels, and in `compareFunction`
   * and the samples of its render target. A texture of another kind, and a change from no texture
   * to one or back, builds the color graph anew and sets `needsUpdate`; three then generates the
   * shader source again, takes program and pipeline out of its caches for a source it has built
   * before and compiles one it has not. Do not alternate such textures every frame.
   */
  set colorMap(value: Texture | undefined) {
    this.#colorMap.set(value);
  }

  get vertexPositionNode() {
    return this.#vertexPositionNode.get();
  }

  set vertexPositionNode(node: Node<'vec3'>) {
    this.#vertexPositionNode.set(node);
  }

  get instancePositionNode() {
    return this.#instancePositionNode.get();
  }

  set instancePositionNode(node: Node<'vec3'>) {
    this.#instancePositionNode.set(node);
  }

  get quadSizeNode() {
    return this.#quadSizeNode.get();
  }

  set quadSizeNode(node: Node<'vec2'>) {
    this.#quadSizeNode.set(node);
  }

  /**
   * @param options the parameters of the material. Every one of them is optional, so another
   *   three.js `Material` or a `Texture` would pass for them; the `isMaterial` and the `isTexture`
   *   they carry keep them out.
   */
  constructor(options: TileSpritesMaterialParameters & {isMaterial?: never; isTexture?: never} = {}) {
    super();

    this.name = options?.name ?? 'twopoint5d.TileSpritesMaterial';

    this.#positionEffect = createEffect(
      () => {
        const vertexPosition = this.vertexPositionNode;
        const instancePosition = this.instancePositionNode;
        const scale = vec3(this.quadSizeNode.x, 0, this.quadSizeNode.y);

        this.positionNode = vertexByInstancePosition({
          vertexPosition,
          instancePosition,
          scale,
        });

        this.needsUpdate = true;
      },
      {attach: this},
    );

    this.#colorEffect = createEffect(
      () => {
        // the graph follows the kind of the color map, not the texture itself: the texture is read
        // untracked here, and #colorMapValueEffect hands a new one of the same kind to the node
        if (this.#colorMapShape() !== undefined) {
          this.#colorTextureNode = colorFromTextureByTexCoords(this.#colorMap.value!, {
            flipDiagonal: attribute<'float'>(TileSpritesMaterial.TexFlipDiagonalAttributeName),
          });
          this.colorNode = this.#colorTextureNode;
        } else {
          this.#colorTextureNode = undefined;
          this.colorNode = TileSpritesMaterial.DefaultColor;
        }

        this.needsUpdate = true;
      },
      {attach: this},
    );

    // three reads the value of a texture node at run time and binds a new texture on its own, so
    // this takes no needsUpdate. On a change of the kind the color effect builds a new node as well;
    // whichever of the two runs first, both end with the new texture in the node
    this.#colorMapValueEffect = createEffect(
      () => {
        const colorMap = this.#colorMap.get();
        if (colorMap != null && this.#colorTextureNode != null) {
          this.#colorTextureNode.value = colorMap;
        }
      },
      {attach: this},
    );

    this.alphaTestNode = float(0.001);

    this.colorMap = options?.colorMap;
  }

  /**
   * Tears down the signals and effects of this material and gives up its optional member:
   * {@link colorMap} answers `undefined` afterwards. The `colorMap` texture itself is handed in
   * and belongs to the caller, so it is not released here. The node accessors keep their last
   * node, and so do `colorNode` and `positionNode`: `dispose()` builds no new one. A second call
   * does nothing.
   */
  override dispose() {
    // the effects go first: a write to a signal runs every effect that reads it on the spot, and
    // clearing the reference below would build a node for a material on its way out
    this.#positionEffect.destroy();
    this.#colorEffect.destroy();
    this.#colorMapValueEffect.destroy();

    // the reference is given up while its signal is still live — a write after
    // SignalGroup.delete() would land in a destroyed signal and notify nobody
    this.#colorMap.set(undefined);

    SignalGroup.delete(this);
    super.dispose();
  }
}
