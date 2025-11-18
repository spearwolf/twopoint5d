import {createSignal} from '@spearwolf/signalize';
import {Texture} from 'three/webgpu';
import {TexturedSpritesMaterial, type TexturedSpritesMaterialParameters} from '../TexturedSprites/TexturedSpritesMaterial.js';

interface AnimatedSpritesMaterialParameters extends TexturedSpritesMaterialParameters {
  animsMap?: Texture;
  time?: number;
}

export class AnimatedSpritesMaterial extends TexturedSpritesMaterial {
  #animsMap = createSignal<Texture | undefined>(undefined, {attach: this});

  get animsMap(): Texture | undefined {
    return this.#animsMap.get();
  }

  set animsMap(value: Texture | undefined) {
    this.#animsMap.set(value);
  }

  time = 0; // TODO

  constructor(options?: AnimatedSpritesMaterialParameters) {
    super(options);
    this.animsMap = options?.animsMap;
  }
}
