import {createEffect, createSignal, SignalGroup} from '@spearwolf/signalize';
import {attribute, float, rotate, vec3, vec4} from 'three/tsl';
import {NodeMaterial, type NodeMaterialParameters, type Texture} from 'three/webgpu';
import {billboardVertexByInstancePosition, colorFromTextureByTexCoords, vertexByInstancePosition} from '../node-utils.js';
import type {
  TAttributeNodeInstancePosition,
  TAttributeNodeQuadSize,
  TAttributeNodeRotation,
  TAttributeNodeTexCoords,
} from './TexturedSprite.js';

export interface TexturedSpritesMaterialParameters extends NodeMaterialParameters {
  name?: string;
  colorMap?: Texture;
  renderAsBillboards?: boolean;
}

export class TexturedSpritesMaterial extends NodeMaterial {
  static readonly PositionAttributeName = 'position';
  static readonly InstancePositionAttributeName = 'instancePosition';
  static readonly RotationAttributeName = 'rotation';
  static readonly QuadSizeAttributeName = 'quadSize';

  #texCoordsNode = createSignal<TAttributeNodeTexCoords | undefined>(undefined, {attach: this});

  #vertexPositionNode = createSignal<TAttributeNodeInstancePosition>(
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

  set vertexPositionNode(node: TAttributeNodeInstancePosition) {
    this.#vertexPositionNode.set(node);
  }

  /** The texture coordinates node — `undefined` once the material has been disposed. */
  get texCoordsNode() {
    return this.#texCoordsNode.get();
  }

  set texCoordsNode(node: TAttributeNodeTexCoords | undefined) {
    this.#texCoordsNode.set(node);
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

    this.name = options?.name ?? 'twopoint5d.TexturedSpritesMaterial';

    this.renderAsBillboards = options?.renderAsBillboards ?? this.#renderAsBillboards.value;

    this.alphaTestNode = float(0.001);

    this.colorMap = options?.colorMap;

    createEffect(
      () => {
        const rotationEulerNode = vec3(0, 0, this.rotationNode.toFloat());
        const vertexPosition = rotate(this.vertexPositionNode, rotationEulerNode);
        const instancePosition = this.instancePositionNode;
        const scale = vec3(this.quadSizeNode.xy, 1.0);

        this.positionNode = (this.renderAsBillboards ? billboardVertexByInstancePosition : vertexByInstancePosition)({
          vertexPosition,
          instancePosition,
          scale,
        });

        this.needsUpdate = true;
      },
      {attach: this},
    );

    createEffect(
      () => {
        if (this.colorMap) {
          this.colorNode = colorFromTextureByTexCoords(this.colorMap, {texCoords: this.texCoordsNode});
        } else {
          this.colorNode = vec4(0.5, 0.5, 0.5, 1); // Default color if no texture is provided
        }

        this.needsUpdate = true;
      },
      {attach: this},
    );
  }

  /**
   * Tears down the signals and effects of this material and gives up its optional members:
   * {@link colorMap} and {@link texCoordsNode} answer `undefined` afterwards. A `colorMap`
   * handed in belongs to the caller and is not released here. The node accessors keep their
   * last node. A second call does nothing.
   */
  override dispose() {
    // both references are given up while their signals are still live — a write after
    // SignalGroup.delete() would land in a destroyed signal and notify nobody
    this.#colorMap.set(undefined);
    this.#texCoordsNode.set(undefined);

    SignalGroup.delete(this);
    super.dispose();
  }
}
