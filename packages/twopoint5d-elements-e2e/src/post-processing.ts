import {DisplayElement, Stage2DElement, TextureStoreElement} from '@spearwolf/twopoint5d-elements';
import {Color, Scene, Sprite, SpriteMaterial} from 'three';
import './display.css';
import './style.css';

const initialize = async (action: (stageEl: Stage2DElement, storeEl: TextureStoreElement) => void) => {
  customElements.define('x-display', DisplayElement);
  customElements.define('x-stage2d', Stage2DElement);
  customElements.define('x-texture-store', TextureStoreElement);

  const elems = await Promise.all([
    Stage2DElement.whenDefined(document.getElementById('stage2d')),
    TextureStoreElement.whenDefined(document.getElementById('texstore')),
  ]);
  action(...elems);
};

initialize((stageEl, {store}) => {
  stageEl.sceneReady().then((scene: Scene) => {
    scene.background = new Color(0x212121);

    const sprite = new Sprite();
    sprite.scale.set(197, 205, 1);
    scene.add(sprite);

    store.get('ballPatternRot', ['texture', 'imageCoords'], ([texture, imageCoords]) => {
      console.log('texture', {texture, imageCoords});

      sprite.material?.dispose();
      sprite.material = new SpriteMaterial({map: texture});
    });
  });
});
