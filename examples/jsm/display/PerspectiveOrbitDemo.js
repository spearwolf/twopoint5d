/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {Color, PerspectiveCamera, Scene} from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

import {Priority} from '../../libs/eventize.js';

import {Display} from './Display.js';

/**
 * Create a [[Display]] with a scene, perspective camera and an orbit control that as a transparent background.
 */
export class PerspectiveOrbitDemo extends Display {
  constructor(...args) {
    super(...args);

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(
      75,
      this.width / this.height,
      0.1,
      1000,
    );
    this.camera.position.z = 30;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.renderer.setClearColor(new Color(0x000000), 0.0);

    this.on('resize', Priority.BB, ({camera, width, height}) => {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });

    this.on('frame', Priority.Low, ({controls, renderer, scene, camera}) => {
      controls.update();
      renderer.render(scene, camera);
    });
  }

  getEmitArgs() {
    return {
      ...super.getEmitArgs(),
      scene: this.scene,
      camera: this.camera,
      controls: this.controls,
    };
  }
}
