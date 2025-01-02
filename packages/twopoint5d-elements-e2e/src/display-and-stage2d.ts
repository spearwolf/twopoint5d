import {Stage2DElement, TextureStoreElement} from '@spearwolf/twopoint5d-elements';
import '@spearwolf/twopoint5d-elements/two5-display.js';
import '@spearwolf/twopoint5d-elements/two5-stage2d.js';
import '@spearwolf/twopoint5d-elements/two5-texture-store.js';
import {Color, Scene, Sprite, SpriteMaterial} from 'three';
import './display.css';
import './style.css';

const initialize = async (action: (stageEl: Stage2DElement, storeEl: TextureStoreElement) => void) => {
  const [stageEl, storeEl] = await Promise.all([
    Stage2DElement.whenDefined(document.getElementById('stage2d')),
    TextureStoreElement.whenDefined(document.getElementById('texstore')),
  ]);
  action(stageEl, storeEl);
};

initialize((stageEl, {store}) => {
  stageEl.sceneReady().then((scene: Scene) => {
    scene.background = new Color(0x212121);

    const sprite = new Sprite();
    sprite.scale.set(197, 205, 1);
    scene.add(sprite);

    store.get('ballPatternRot', ['texture', 'imageCoords'], ([texture, imageCoords]) => {
      // eslint-disable-next-line no-console
      console.log('texture', {texture, imageCoords});

      sprite.material?.dispose();
      sprite.material = new SpriteMaterial({map: texture});
    });
  });
});
