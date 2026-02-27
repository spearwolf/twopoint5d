import {createEffect, createSignal, SignalGroup} from '@spearwolf/signalize';
import {attribute, float, vec3, vec4} from 'three/tsl';
import {type Node, NodeMaterial, type Texture} from 'three/webgpu';
import {colorFromTextureByTexCoords, vertexByInstancePosition} from '../../sprites/node-utils.js';

export interface TileSpritesMaterialParameters {
  name?: string;
  colorMap?: Texture;
}

const createShaderAttributeNodeSignal = <T = unknown>(name: string, attach: object) =>
  createSignal<Node<T>>(attribute(name), {attach});

export class TileSpritesMaterial extends NodeMaterial {
  static readonly PositionAttributeName = 'position';
  static readonly InstancePositionAttributeName = 'instancePosition';
  static readonly QuadSizeAttributeName = 'quadSize';

  static readonly DefaultColor = vec4(0.5, 0.5, 0.5, 1); // Default color if no texture is provided

  #vertexPositionNode = createShaderAttributeNodeSignal<'vec3'>(TileSpritesMaterial.PositionAttributeName, this);
  #instancePositionNode = createShaderAttributeNodeSignal<'vec3'>(TileSpritesMaterial.InstancePositionAttributeName, this);
  #quadSizeNode = createShaderAttributeNodeSignal<'vec2'>(TileSpritesMaterial.QuadSizeAttributeName, this);

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

  constructor(options: TileSpritesMaterialParameters = {}) {
    super();

    this.name = options?.name ?? 'twopoint5d.TileSpritesMaterial';

    createEffect(
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

    createEffect(
      () => {
        const colorMap = this.colorMap;

        this.colorNode = colorMap ? colorFromTextureByTexCoords(colorMap) : TileSpritesMaterial.DefaultColor;

        this.needsUpdate = true;
      },
      {attach: this},
    );

    this.alphaTestNode = float(0.001);

    this.colorMap = options?.colorMap;
  }

  override dispose() {
    SignalGroup.destroy(this);
    super.dispose();
  }
}
