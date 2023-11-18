import {TextureStore} from '@spearwolf/twopoint5d';
import {DisplayElement, Stage2DElement} from '@spearwolf/twopoint5d-elements';
import {Color, Scene, Sprite, SpriteMaterial} from 'three';
import './display.css';
import './style.css';

const initialize = async (action: (el: Stage2DElement) => void) => {
  customElements.define('x-display', DisplayElement);
  customElements.define('x-stage2d', Stage2DElement);

  const el = await Stage2DElement.whenDefined(document.getElementById('stage2d'));
  action(el);
};

const textures = new TextureStore().load('/assets/textures.json');

initialize((el) => {
  el.sceneReady().then((scene: Scene) => {
    scene.background = new Color(0x212121);
  });

  el.firstFrame().then(({renderer, scene}) => {
    textures.renderer = renderer;

    const sprite = new Sprite();
    sprite.scale.set(197, 205, 1);
    scene.add(sprite);

    textures.get('ballPatternRot', ['texture', 'imageCoords'], ([texture, imageCoords]) => {
      console.log('texture', {texture, imageCoords});

      sprite.material?.dispose();
      sprite.material = new SpriteMaterial({map: texture});
    });
  });
});
