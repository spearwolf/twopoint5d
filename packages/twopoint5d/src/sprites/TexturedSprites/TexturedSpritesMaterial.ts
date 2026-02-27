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

  #vertexPositionNode = createSignal<TAttributeNodeInstancePosition>(attribute(TexturedSpritesMaterial.PositionAttributeName), {
    attach: this,
  });

  #rotationNode = createSignal<TAttributeNodeRotation>(attribute(TexturedSpritesMaterial.RotationAttributeName), {attach: this});

  #instancePositionNode = createSignal<TAttributeNodeInstancePosition>(
    attribute(TexturedSpritesMaterial.InstancePositionAttributeName),
    {
      attach: this,
    },
  );

  #quadSizeNode = createSignal<TAttributeNodeQuadSize>(attribute(TexturedSpritesMaterial.QuadSizeAttributeName), {attach: this});

  #renderAsBillboards = createSignal(false, {attach: this});

  #colorMap = createSignal<Texture | undefined>(undefined, {attach: this});

  get colorMap(): Texture | undefined {
    return this.#colorMap.get();
  }

  set colorMap(value: Texture | undefined) {
    this.#colorMap.set(value);
  }

  get vertexPositionNode() {
    return this.#vertexPositionNode.get();
  }

  set vertexPositionNode(node: TAttributeNodeInstancePosition) {
    this.#vertexPositionNode.set(node);
  }

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

  override dispose() {
    SignalGroup.destroy(this);
    super.dispose();
  }
}
