import {on, Priority} from '@spearwolf/eventize';
import {Display, OnDisplayRenderFrame, OnDisplayResize, type DisplayEventProps} from '@spearwolf/twopoint5d';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Color, PerspectiveCamera, Scene} from 'three/webgpu';

export interface PerspectiveOrbitDemoEventProps extends DisplayEventProps {
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
}

/**
 * A {@link Display} with a scene, a perspective camera and orbit controls, drawn on a transparent
 * background. Its `dispose()` frees the orbit controls as well; what a page puts into the scene,
 * the page frees itself.
 */
export class PerspectiveOrbitDemo extends Display {
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;

  constructor(...args: ConstructorParameters<typeof Display>) {
    super(...args);

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
    this.camera.position.z = 30;

    // inside the constructor of a Display subclass the renderer exists: `super(...)` made it
    this.controls = new OrbitControls(this.camera, this.renderer!.domElement);
    this.controls.enableDamping = true;
    // the controls hold listeners on the canvas and on the document, which a Display does not know of
    this.onDispose(() => this.controls.dispose());

    on(this, 'enableOrbitControls', (enabled) => {
      this.controls.enabled = enabled;
    });

    this.renderer!.setClearColor(new Color(0x000000), 0.0);

    on(this, OnDisplayResize, Priority.BB, ({camera, width, height}) => {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });

    on(this, OnDisplayRenderFrame, Priority.Low, ({controls, renderer, scene, camera}: PerspectiveOrbitDemoEventProps) => {
      controls.update();
      renderer.render(scene, camera);
    });

    (window as any).display = this;
  }

  override getEventProps(): PerspectiveOrbitDemoEventProps {
    return {
      ...super.getEventProps(),
      scene: this.scene,
      camera: this.camera,
      controls: this.controls,
    };
  }
}
