import type {PostProcessingRenderer, TextureStore} from '@spearwolf/twopoint5d';
import {DisplayElement, PostProcessingElement, Stage2DElement, TextureStoreElement} from '@spearwolf/twopoint5d-elements';
import {Color, Scene, Sprite, SpriteMaterial} from 'three';
import {GlitchPass} from 'three/addons/postprocessing/GlitchPass.js';
import './display.css';
import './style.css';

const initialize = async (
  action: (frame: {scene: Scene}, store: TextureStore, postProcessing: PostProcessingRenderer) => void,
) => {
  customElements.define('x-display', DisplayElement);
  customElements.define('x-stage2d', Stage2DElement);
  customElements.define('x-texture-store', TextureStoreElement);
  customElements.define('x-post-processing', PostProcessingElement);

  const [stageEl, storeEl, postProcessingEl] = await Promise.all([
    Stage2DElement.whenDefined(document.getElementById('stage2d')),
    TextureStoreElement.whenDefined(document.getElementById('texstore')),
    PostProcessingElement.whenDefined(document.getElementById('pp')),
  ]);

  action(await stageEl.firstFrame(), storeEl.store, postProcessingEl.renderer);
};

initialize(({scene}, textureStore, postProcessing) => {
  scene.background = new Color(0x212121);

  const glitchPass = new GlitchPass();
  postProcessing.addPass(glitchPass);

  const sprite = new Sprite();
  sprite.scale.set(197, 205, 1);
  scene.add(sprite);

  textureStore.get('ballPatternRot', ['texture', 'imageCoords'], ([texture, imageCoords]) => {
    console.log('texture', {texture, imageCoords});

    sprite.material?.dispose();
    sprite.material = new SpriteMaterial({map: texture});
  });
});
