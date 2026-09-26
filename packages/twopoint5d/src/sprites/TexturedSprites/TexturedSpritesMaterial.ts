import {createEffect, createSignal, type Effect, SignalGroup} from '@spearwolf/signalize';
import {attribute, float, mul, rotate, vec3, vec4, vertexColor} from 'three/tsl';
import {NodeMaterial, type NodeMaterialParameters, type Texture} from 'three/webgpu';
import {billboardVertexByInstancePosition, colorFromTextureByTexCoords, vertexByInstancePosition} from '../node-utils.js';
import type {
  TAttributeNodeInstancePosition,
  TAttributeNodeQuadSize,
  TAttributeNodeRotation,
  TAttributeNodeTexCoords,
  TAttributeNodeTexFlipDiagonal,
  TAttributeNodeVertexPosition,
} from './TexturedSprite.js';

/**
 * The options of a {@link TexturedSpritesMaterial}. Every three.js material parameter among them
 * reaches the material through `setValues()`. `positionNode` and `colorNode` are not among them:
 * the material builds both nodes itself.
 *
 * Without an `alphaTest` or `alphaTestNode` the material drops every texel with an alpha of
 * `0.001` or less. Either of the two takes the place of that default alpha test.
 */
export interface TexturedSpritesMaterialParameters extends Omit<NodeMaterialParameters, 'positionNode' | 'colorNode'> {
  name?: string;
  colorMap?: Texture;
  renderAsBillboards?: boolean;
}

export class TexturedSpritesMaterial extends NodeMaterial {
  static readonly PositionAttributeName = 'position';
  static readonly InstancePositionAttributeName = 'instancePosition';
  static readonly RotationAttributeName = 'rotation';
  static readonly QuadSizeAttributeName = 'quadSize';
  static readonly TexFlipDiagonalAttributeName = 'texFlipDiagonal';

  #texCoordsNode = createSignal<TAttributeNodeTexCoords | undefined>(undefined, {attach: this});

  #texFlipDiagonalNode = createSignal<TAttributeNodeTexFlipDiagonal | undefined>(undefined, {attach: this});

  #vertexPositionNode = createSignal<TAttributeNodeVertexPosition>(
    attribute<'vec3'>(TexturedSpritesMaterial.PositionAttributeName),
    {
      attach: this,
    },
  );

  #rotationNode = createSignal<TAttributeNodeRotation>(attribute<'float'>(TexturedSpritesMaterial.RotationAttributeName), {
    attach: this,
  });

  #instancePositionNode = createSignal<TAttributeNodeInstancePosition>(
    attribute<'vec3'>(TexturedSpritesMaterial.InstancePositionAttributeName),
    {
      attach: this,
    },
  );

  #quadSizeNode = createSignal<TAttributeNodeQuadSize>(attribute<'vec2'>(TexturedSpritesMaterial.QuadSizeAttributeName), {
    attach: this,
  });

  #renderAsBillboards = createSignal(false, {attach: this});

  #colorMap = createSignal<Texture | undefined>(undefined, {attach: this});

  readonly #positionEffect: Effect;

  readonly #colorEffect: Effect;

  /** The color map texture — `undefined` once the material has been disposed. */
  get colorMap(): Texture | undefined {
    return this.#colorMap.get();
  }

  /** Sets the color map texture. The texture stays the caller's; {@link dispose} does not release it. */
  set colorMap(value: Texture | undefined) {
    this.#colorMap.set(value);
  }

  get vertexPositionNode() {
    return this.#vertexPositionNode.get();
  }

  set vertexPositionNode(node: TAttributeNodeVertexPosition) {
    this.#vertexPositionNode.set(node);
  }

  /** The texture coordinates node — `undefined` once the material has been disposed. */
  get texCoordsNode() {
    return this.#texCoordsNode.get();
  }

  set texCoordsNode(node: TAttributeNodeTexCoords | undefined) {
    this.#texCoordsNode.set(node);
  }

  /**
   * The node the diagonal flip of the frame comes from; `undefined` stands for the
   * `texFlipDiagonal` attribute of the geometry, and it is what the getter answers once the
   * material has been disposed.
   */
  get texFlipDiagonalNode() {
    return this.#texFlipDiagonalNode.get();
  }

  set texFlipDiagonalNode(node: TAttributeNodeTexFlipDiagonal | undefined) {
    this.#texFlipDiagonalNode.set(node);
  }

  get rotationNode() {
    return this.#rotationNode.get();
  }

  set rotationNode(node: TAttributeNodeRotation) {
    this.#rotationNode.set(node);
  }

  get instancePositionNode() {
    return this.#instancePositionNode.get();
  }

  set instancePositionNode(node: TAttributeNodeInstancePosition) {
    this.#instancePositionNode.set(node);
  }

  get quadSizeNode() {
    return this.#quadSizeNode.get();
  }

  set quadSizeNode(node: TAttributeNodeQuadSize) {
    this.#quadSizeNode.set(node);
  }

  /**
   * Whether the sprites face the camera. Keeps its last value once the material has been
   * disposed, and a write there reaches nothing that still renders.
   */
  get renderAsBillboards() {
    return this.#renderAsBillboards.get();
  }

  set renderAsBillboards(value: boolean) {
    this.#renderAsBillboards.set(value);
  }

  constructor(options?: TexturedSpritesMaterialParameters) {
    super();

    // the options of this material stay out of setValues(): Material.setValues() skips each key
    // whose current value is undefined with a warning — colorMap before its first assignment —
    // and name and renderAsBillboards bring defaults of their own
    const {name, colorMap, renderAsBillboards, ...materialParameters} = options ?? {};

    this.name = name ?? 'twopoint5d.TexturedSpritesMaterial';

    this.renderAsBillboards = renderAsBillboards ?? this.#renderAsBillboards.value;

    // the default alpha test drops the fully transparent texels of a color map; an alphaTest or
    // alphaTestNode of the caller takes its place, since three no longer looks at alphaTest once
    // an alphaTestNode is set
    if (materialParameters.alphaTest == null && materialParameters.alphaTestNode == null) {
      this.alphaTestNode = float(0.001);
    }

    this.setValues(materialParameters);

    this.colorMap = colorMap;

    this.#positionEffect = createEffect(
      () => {
        const rotationEulerNode = vec3(0, 0, this.rotationNode.toFloat());
        const scale = vec3(this.quadSizeNode.xy, 1.0);
        // scale before rotate: the other way round turns the unit quad and stretches the result,
        // and a sprite that is not square comes out as a parallelogram
        const vertexPosition = rotate(mul(this.vertexPositionNode, scale), rotationEulerNode);
        const instancePosition = this.instancePositionNode;

        this.positionNode = (this.renderAsBillboards ? billboardVertexByInstancePosition : vertexByInstancePosition)({
          vertexPosition,
          instancePosition,
          // the quad arrives scaled already; without a scale of its own, billboarding would
          // fall back to the quadSize attribute and scale it a second time
          scale: vec3(1, 1, 1),
        });

        this.needsUpdate = true;
      },
      {attach: this},
    );

    this.#colorEffect = createEffect(
      () => {
        // every sprite is tinted by its color attribute, alpha included; vertexColor() answers
        // white for a geometry without that attribute, so sprites that carry none draw as they are
        const spriteColor = vertexColor();

        // texCoordsNode and texFlipDiagonalNode are read only behind the colorMap: without one, a
        // write to either of them has nothing to rebuild
        if (this.colorMap) {
          this.colorNode = mul(
            colorFromTextureByTexCoords(this.colorMap, {
              texCoords: this.texCoordsNode,
              flipDiagonal: this.texFlipDiagonalNode ?? attribute<'float'>(TexturedSpritesMaterial.TexFlipDiagonalAttributeName),
            }),
            spriteColor,
          );
        } else {
          this.colorNode = mul(vec4(0.5, 0.5, 0.5, 1), spriteColor); // Default color if no texture is provided
        }

        this.needsUpdate = true;
      },
      {attach: this},
    );
  }

  /**
   * Tears down the signals and effects of this material and gives up its optional members:
   * {@link colorMap}, {@link texCoordsNode} and {@link texFlipDiagonalNode} answer `undefined`
   * afterwards. A `colorMap` handed in belongs to the caller and is not released here. The node
   * accessors keep their last node, and so do `colorNode` and `positionNode`: `dispose()` builds
   * no new one. A second call does nothing.
   */
  override dispose() {
    // the effects go first: a write to a signal runs every effect that reads it on the spot, and
    // clearing the references below would build nodes for a material on its way out
    this.#positionEffect.destroy();
    this.#colorEffect.destroy();

    // the references are given up while their signals are still live — a write after
    // SignalGroup.delete() would land in a destroyed signal and notify nobody
    this.#colorMap.set(undefined);
    this.#texCoordsNode.set(undefined);
    this.#texFlipDiagonalNode.set(undefined);

    SignalGroup.delete(this);
    super.dispose();
  }
}
