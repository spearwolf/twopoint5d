import {
  createEffect,
  createMemo,
  createSignal,
  destroySignal,
  type Effect,
  type Signal,
  SignalGroup,
  type SignalReader,
} from '@spearwolf/signalize';
import {add, attribute, float, mul, sub, texture, vec3, vec4} from 'three/tsl';
import {type Node, NodeMaterial, type NodeMaterialParameters, type Texture} from 'three/webgpu';
import type {SpriteKind} from '../defineSprite.js';
import type {
  SpriteFeature,
  SpriteFrameContext,
  SpriteFrameNodes,
  SpriteShaderContext,
  SpriteUniformValue,
} from '../SpriteFeature.js';
import type {SpritePipeline} from '../spritePipeline.js';
import {SpriteResources, type SpriteUniformNode} from './SpriteResources.js';

/**
 * The options of a {@link FeatureSpritesMaterial}. Every three.js material parameter among them
 * reaches the material through `setValues()`; `positionNode` and `colorNode` are not among them.
 * Without an `alphaTest` or `alphaTestNode` the material drops every texel with an alpha of
 * `0.001` or less.
 */
export interface FeatureSpritesMaterialParameters extends Omit<NodeMaterialParameters, 'positionNode' | 'colorNode'> {
  name?: string;
  /** The textures to start with, by the names the features declare. They stay the caller's. */
  textures?: Readonly<Record<string, Texture | undefined>>;
  /** Start values of uniforms, by the names the features declare. */
  uniforms?: Readonly<Record<string, SpriteUniformValue | undefined>>;
  /** Another placement to start with — see {@link FeatureSpritesMaterial.placement}. */
  placement?: SpriteFeature;
  /**
   * Uniforms and textures shared with other materials; they stay the caller's. Without them the
   * material builds its own from `textures` and `uniforms` and releases them in `dispose()`.
   * Resources that have been disposed are refused.
   */
  resources?: SpriteResources;
}

type TextureNode = ReturnType<typeof texture>;
type GraphScope = 'frame' | 'position' | 'color';
const SCOPES: readonly GraphScope[] = ['frame', 'position', 'color'];

const WHERE = 'FeatureSpritesMaterial';

const defaultFrame = (): SpriteFrameNodes => ({texCoords: vec4(0, 0, 1, 1) as unknown as Node<'vec4'>});

// uv is where the vertex lies on the untrimmed sprite, x to the right and y downwards. A trimmed
// frame covers the part between its margins, so every corner moves to its corner of that part; y
// is negated because the position counts upwards. The shift is measured in the unit quad and comes
// before every local stage, so that it scales, shears and turns with the sprite
const trimShift = (position: Node<'vec3'>, uv: Node<'vec2'>, trim: Node<'vec4'>): Node<'vec3'> => {
  const trimmedUv = add(trim.xy, mul(uv, sub(float(1), add(trim.xy, trim.zw))));
  const shift = sub(trimmedUv, uv);
  return add(position, vec3(shift.x, shift.y.negate(), 0)) as unknown as Node<'vec3'>;
};

/**
 * The material of a sprite kind: folds the pipeline of the kind into `positionNode` and
 * `colorNode`. A feature whose textures are not all set — or, with `needsImage`, have no image —
 * drops out of the graph until they are: the frame falls back to its defaults, the color source
 * to flat grey.
 */
export class FeatureSpritesMaterial<Api extends object = object> extends NodeMaterial {
  readonly isFeatureSpritesMaterial = true;

  readonly kind: SpriteKind<Api>;
  readonly resources: SpriteResources;

  readonly #features: readonly SpriteFeature[];
  readonly #pipeline: SpritePipeline;
  readonly #attributeNames: ReadonlySet<string>;
  readonly #ownsResources: boolean;
  readonly #placement: Signal<SpriteFeature>;
  readonly #samples: Record<GraphScope, {name: string; node: TextureNode}[]> = {frame: [], position: [], color: []};
  readonly #frame: SignalReader<SpriteFrameNodes>;
  readonly #positionEffect: Effect;
  readonly #colorEffect: Effect;
  readonly #textureValueEffect: Effect;
  #disposed = false;

  /**
   * @param options every one of them is optional, so another three.js `Material` or a `Texture`
   *   would pass for them; the `isMaterial` and the `isTexture` they carry keep them out.
   */
  constructor(kind: SpriteKind<Api>, options?: FeatureSpritesMaterialParameters & {isMaterial?: never; isTexture?: never}) {
    super();

    // the options of this material stay out of setValues(): Material.setValues() warns about every
    // key whose current value is undefined
    const {name, textures, uniforms, placement, resources, ...materialParameters} = options ?? {};

    this.kind = kind;
    this.name = name ?? 'twopoint5d.FeatureSpritesMaterial';
    this.#features = kind.features;
    this.#pipeline = kind.pipeline;
    this.#attributeNames = new Set([
      ...Object.keys(kind.description.attributes),
      ...Object.keys(kind.base.description.attributes),
    ]);

    if (resources != null && (textures != null || uniforms != null)) {
      throw new TypeError(`${WHERE}: textures and uniforms belong to the resources handed in`);
    }
    if (resources?.isDisposed) {
      throw new TypeError(`${WHERE}: the resources handed in have been disposed`);
    }
    this.#ownsResources = resources == null;
    this.resources = resources ?? new SpriteResources(this.#features, {textures, uniforms}, WHERE);
    // what the constructor builds from here on is released again on every throw — an effect or the
    // frame memo whose first run throws stays alive in the group it is attached to, and resources
    // the constructor built itself are released with it; resources handed in stay the caller's
    try {
      for (const feature of this.#features) {
        if (!this.resources.declares(feature)) {
          throw new TypeError(`${WHERE}: the resources handed in lack what feature "${feature.name}" declares`);
        }
      }

      this.#placement = createSignal<SpriteFeature>(this.#pipeline.placement!, {attach: this});
      if (placement != null) this.placement = placement;

      // the default alpha test drops the fully transparent texels of a color map; an alphaTest or
      // alphaTestNode of the caller takes its place, since three no longer looks at alphaTest once
      // an alphaTestNode is set
      if (materialParameters.alphaTest == null && materialParameters.alphaTestNode == null) {
        this.alphaTestNode = float(0.001);
      }
      this.setValues(materialParameters);

      // the frame is built once per graph generation and read by both effects below: a change of the
      // shape of a texture of the frame feature rebuilds each of them once
      this.#frame = createMemo(
        () => {
          this.#samples.frame.length = 0;
          const feature = this.#pipeline.frame;
          return feature != null && this.#isActive(feature)
            ? feature.frame!(this.#frameContext(feature, 'frame'))
            : defaultFrame();
        },
        {attach: this},
      );

      this.#positionEffect = createEffect(
        () => {
          const frame = this.#frame();
          const placementFeature = this.#placement.get();
          this.#samples.position.length = 0;

          let position = attribute<'vec3'>('position') as unknown as Node<'vec3'>;
          if (frame.trim != null) position = trimShift(position, attribute<'vec2'>('uv') as unknown as Node<'vec2'>, frame.trim);
          for (const feature of this.#pipeline.local) {
            if (this.#isActive(feature))
              position = feature.local!.transform(position, this.#shaderContext(feature, 'position', frame));
          }
          position = placementFeature.placement!(position, this.#shaderContext(placementFeature, 'position', frame));
          for (const feature of this.#pipeline.mesh) {
            if (this.#isActive(feature))
              position = feature.mesh!.transform(position, this.#shaderContext(feature, 'position', frame));
          }

          this.positionNode = position;
          this.needsUpdate = true;
        },
        {attach: this},
      );

      this.#colorEffect = createEffect(
        () => {
          const frame = this.#frame();
          this.#samples.color.length = 0;

          const source = this.#pipeline.colorSource;
          let color =
            source != null && this.#isActive(source)
              ? source.colorSource!(frame, this.#shaderContext(source, 'color', frame))
              : (vec4(0.5, 0.5, 0.5, 1) as unknown as Node<'vec4'>);
          for (const feature of this.#pipeline.color) {
            if (this.#isActive(feature)) color = feature.color!.transform(color, this.#shaderContext(feature, 'color', frame));
          }

          this.colorNode = color;
          this.needsUpdate = true;
        },
        {attach: this},
      );

      // three reads the value of a texture node at run time and binds a new texture on its own, so
      // this takes no needsUpdate. On a change of the shape the graphs above build new nodes from the
      // current texture as well; whichever runs first, both end with the new texture in every node
      this.#textureValueEffect = createEffect(
        () => {
          for (const textureName of this.resources.textureNames) {
            const value = this.resources.getTexture(textureName);
            if (value == null) continue;
            for (const scope of SCOPES) {
              for (const sample of this.#samples[scope]) {
                if (sample.name === textureName) sample.node.value = value;
              }
            }
          }
        },
        {attach: this},
      );
    } catch (error) {
      // the group goes first, the opposite of dispose(): an effect whose first run threw never
      // reached its field and is reachable only through the group, and it has to be gone before
      // the release below writes the texture signals it reads
      SignalGroup.delete(this);
      if (this.#ownsResources) this.resources.dispose();
      throw error;
    }
  }

  // a tracked read: the graphs rebuild when the shape of a texture of the feature changes
  #isActive(feature: SpriteFeature): boolean {
    for (const textureName of Object.keys(feature.textures ?? {})) {
      if (this.resources.shapeOf(textureName) === undefined) return false;
    }
    return true;
  }

  #frameContext(feature: SpriteFeature, scope: GraphScope): SpriteFrameContext {
    const where = `${WHERE}: feature "${feature.name}"`;
    const ownTexture = (textureName: string) => {
      if (feature.textures?.[textureName] == null) {
        throw new Error(`${where} reads the texture "${textureName}", which it does not declare`);
      }
    };
    return {
      attribute: <T extends string>(attributeName: string) => {
        if (!this.#attributeNames.has(attributeName)) {
          throw new Error(`${where} reads the attribute "${attributeName}", which the sprite kind does not hold`);
        }
        return attribute(attributeName) as unknown as Node<T>;
      },
      uniform: <T extends string>(uniformName: string) => this.resources.uniform(uniformName, where) as unknown as Node<T>,
      sample: (textureName, uv) => {
        ownTexture(textureName);
        // the feature is active, so its texture is set: the node starts with it, and the value
        // effect hands it every later texture of the same kind
        const node = texture(this.resources.peekTexture(textureName)!, uv);
        this.#samples[scope].push({name: textureName, node});
        return node as unknown as Node<'vec4'>;
      },
      textureSize: (textureName) => {
        ownTexture(textureName);
        return this.resources.textureSize(textureName) as unknown as Node<'vec2'>;
      },
    };
  }

  #shaderContext(feature: SpriteFeature, scope: GraphScope, frame: SpriteFrameNodes): SpriteShaderContext {
    return {...this.#frameContext(feature, scope), frame};
  }

  /** The uniforms of the material, by declared name. Readable and writable after `dispose()`. */
  get uniforms(): Readonly<Record<string, SpriteUniformNode>> {
    return this.resources.uniforms;
  }

  /** Writes a uniform; see {@link SpriteResources.setUniform}. */
  setUniform(name: string, x: number, y?: number, z?: number, w?: number): void {
    this.resources.setUniform(name, x, y, z, w);
  }

  /** The texture `name`; `undefined` once a material that owns its resources has been disposed. */
  getTexture(name: string): Texture | undefined {
    return this.resources.getTexture(name);
  }

  /**
   * Sets the texture `name`. It stays the caller's. A texture of the same kind — alike in
   * `colorSpace`, `type`, `format`, the way three binds it, the two filter tests, `compareFunction`
   * and the samples of its render target (see `textureShapeKey()`) — takes the place of the one set
   * without a rebuild. Another kind, or a change between none and one, rebuilds the graphs that
   * read it and sets `needsUpdate`; three takes program and pipeline out of its caches for a source
   * it has built before. Do not alternate such textures every frame.
   */
  setTexture(name: string, value: Texture | undefined): void {
    this.resources.setTexture(name, value);
  }

  /** Re-reads the texture `name` once a loader filled in its image; see {@link SpriteResources.touchTexture}. */
  touchTexture(name: string): void {
    this.resources.touchTexture(name);
  }

  /** The placement the position graph is built with. Keeps its last value once disposed. */
  get placement(): SpriteFeature {
    return this.#placement.value;
  }

  set placement(feature: SpriteFeature) {
    this.#placement.set(feature);
  }

  /**
   * Tears down the effects and signals of the material and releases the resources it built. A
   * texture handed in stays the caller's, and so do resources handed in. `positionNode` and
   * `colorNode` keep their last node. A second call does nothing.
   */
  override dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // the effects and the frame memo go first: the release of the resources below writes to the
    // texture signals, which would build nodes for a material on its way out
    this.#positionEffect.destroy();
    this.#colorEffect.destroy();
    this.#textureValueEffect.destroy();
    destroySignal(this.#frame);

    if (this.#ownsResources) this.resources.dispose();

    SignalGroup.delete(this);
    super.dispose();
  }
}
