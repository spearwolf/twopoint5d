import type {PostProcessingRenderer, TextureStore} from '@spearwolf/twopoint5d';
import {
  DisplayElement,
  GlitchPassElement,
  PostProcessingElement,
  Stage2DElement,
  TextureStoreElement,
  UnrealBloomPassElement,
} from '@spearwolf/twopoint5d-elements';
import {Color, Scene, Sprite, SpriteMaterial} from 'three';
import './display.css';
import './style.css';

const initialize = async (
  action: (frame: {scene: Scene}, store: TextureStore, postProcessing: PostProcessingRenderer) => void,
) => {
  customElements.define('x-display', DisplayElement);
  customElements.define('x-stage2d', Stage2DElement);
  customElements.define('x-texture-store', TextureStoreElement);
  customElements.define('x-post-processing', PostProcessingElement);
  customElements.define('x-glitch-pass', GlitchPassElement);
  customElements.define('x-unreal-bloom-pass', UnrealBloomPassElement);

  const [stageEl, storeEl, postProcessingEl] = await Promise.all([
    Stage2DElement.whenDefined(document.getElementById('stage2d')),
    TextureStoreElement.whenDefined(document.getElementById('texstore')),
    PostProcessingElement.whenDefined(document.getElementById('pp')),
  ]);

  action(await stageEl.firstFrame(), storeEl.store, postProcessingEl.renderer);
};

initialize(({scene}, textureStore, _postProcessing) => {
  scene.background = new Color(0x212121);

  const sprite = new Sprite();
  sprite.scale.set(197, 205, 1);
  scene.add(sprite);

  textureStore.get('ballPatternRot', ['texture', 'imageCoords'], ([texture, imageCoords]) => {
    console.log('texture', {texture, imageCoords});

    sprite.material?.dispose();
    sprite.material = new SpriteMaterial({map: texture});
  });
});
