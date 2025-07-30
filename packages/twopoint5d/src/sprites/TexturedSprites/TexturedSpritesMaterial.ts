import {createEffect, createSignal, SignalGroup} from '@spearwolf/signalize';
import {attribute, float, rotate, vec3, vec4, type ShaderNodeObject} from 'three/tsl';
import {Node, NodeMaterial, Texture} from 'three/webgpu';
import {billboardVertexByInstancePosition, colorFromTextureByTexCoords, vertexByInstancePosition} from '../node-utils.js';

export interface TexturedSpritesMaterialParameters {
  name?: string;
  colorMap?: Texture;
}

const createShaderAttributeNodeSignal = (name: string, attach: object) =>
  createSignal<ShaderNodeObject<Node>>(attribute(name), {attach});

export class TexturedSpritesMaterial extends NodeMaterial {
  static readonly PositionAttributeName = 'position';
  static readonly InstancePositionAttributeName = 'instancePosition';
  static readonly RotationAttributeName = 'instancePosition';
  static readonly QuadSizeAttributeName = 'quadSize';

  #vertexPositionNode = createShaderAttributeNodeSignal(TexturedSpritesMaterial.PositionAttributeName, this);
  #rotationNode = createShaderAttributeNodeSignal(TexturedSpritesMaterial.RotationAttributeName, this);
  #instancePositionNode = createShaderAttributeNodeSignal(TexturedSpritesMaterial.InstancePositionAttributeName, this);
  #quadSizeNode = createShaderAttributeNodeSignal(TexturedSpritesMaterial.QuadSizeAttributeName, this);

  #renderAsBillboards = createSignal(false, {attach: this});

  get vertexPositionNode() {
    return this.#vertexPositionNode.get();
  }

  set vertexPositionNode(node: ShaderNodeObject<Node>) {
    this.#vertexPositionNode.set(node);
  }

  get rotationNode() {
    return this.#rotationNode.get();
  }

  set rotationNode(node: ShaderNodeObject<Node>) {
    this.#rotationNode.set(node);
  }

  get instancePositionNode() {
    return this.#instancePositionNode.get();
  }

  set instancePositionNode(node: ShaderNodeObject<Node>) {
    this.#instancePositionNode.set(node);
  }

  get quadSizeNode() {
    return this.#quadSizeNode.get();
  }

  set quadSizeNode(node: ShaderNodeObject<Node>) {
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

    this.alphaTestNode = float(0.001);

    this.colorMap = options?.colorMap;
  }

  #colorMap: Texture | undefined;

  get colorMap(): Texture | undefined {
    return this.#colorMap;
  }

  set colorMap(colorMap: Texture | undefined) {
    if (this.#colorMap === colorMap) return;
    this.#colorMap = colorMap;

    if (!colorMap) {
      this.colorNode = vec4(0.5, 0.5, 0.5, 1); // Default color if no texture is provided
      return;
    }

    this.colorNode = colorFromTextureByTexCoords(colorMap);
  }

  override dispose() {
    SignalGroup.destroy(this);
    super.dispose();
  }
}
