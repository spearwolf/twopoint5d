import {attribute, float, vec3, vec4} from 'three/tsl';
import {NodeMaterial, Texture} from 'three/webgpu';
import {colorFromTextureByTexCoords, positionByInstancePosition} from '../node-utils.js';

export interface TexturedSpritesMaterialParameters {
  name?: string;
  colorMap?: Texture;
}

export class TexturedSpritesMaterial extends NodeMaterial {
  constructor(options?: TexturedSpritesMaterialParameters) {
    super();

    this.name = options?.name ?? 'twopoint5d.TexturedSpritesMaterial';

    this.positionNode = positionByInstancePosition({scale: vec3(attribute('quadSize'), 1.0)});

    // TODO add support for rotation
    // TODO add support for billboard

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

  get renderAsBillboards(): boolean {
    // TODO return this.defines?.['RENDER_AS_BILLBOARDS'] === 1;
    return true;
  }

  set renderAsBillboards(_renderAsBillboards: boolean) {
    // TODO this.updateBoolDefine('RENDER_AS_BILLBOARDS', renderAsBillboards);
  }
}
