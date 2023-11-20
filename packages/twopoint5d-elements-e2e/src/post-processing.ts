import type {TextureStore} from '@spearwolf/twopoint5d';
import {DisplayElement, Stage2DElement, TextureStoreElement} from '@spearwolf/twopoint5d-elements';
import {Color, Scene, Sprite, SpriteMaterial} from 'three';
import './display.css';
import './style.css';

const initialize = async (action: (scene: Scene, store: TextureStore) => void) => {
  customElements.define('x-display', DisplayElement);
  customElements.define('x-stage2d', Stage2DElement);
  customElements.define('x-texture-store', TextureStoreElement);

  const [stageEl, storeEl] = await Promise.all([
    Stage2DElement.whenDefined(document.getElementById('stage2d')),
    TextureStoreElement.whenDefined(document.getElementById('texstore')),
  ]);

  action(await stageEl.sceneReady(), storeEl.store);
};

initialize((scene, textureStore) => {
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
