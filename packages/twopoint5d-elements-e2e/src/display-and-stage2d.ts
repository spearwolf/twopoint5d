import {TextureStore} from '@spearwolf/twopoint5d';
import {Stage2DElement} from '@spearwolf/twopoint5d-elements';
import '@spearwolf/twopoint5d-elements/two5-display.js';
import '@spearwolf/twopoint5d-elements/two5-stage2d.js';
import {Color, Scene, Sprite, SpriteMaterial} from 'three';
import './display.css';
import './style.css';

console.log('hej ho!');

const textures = new TextureStore().load('/assets/textures.json');

Stage2DElement.whenDefined(document.getElementById('stage2d')).then((el) => {
  // let renderFrameLogCount = 0;

  // el.addEventListener(StageResize, (e: StageResizeEvent) => {
  //   renderFrameLogCount = 0;
  //   console.debug(StageResize, e.detail);
  // });

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

  // el.on(StageRenderFrame, (props: StageRenderFrameProps) => {
  //   if (renderFrameLogCount++ < 3) {
  //     console.debug(StageRenderFrame, props.frameNo, props);
  //   }
  // });
});
