// The camera of a `Stage2D`: which one the stage draws with — the camera of a driver, one
// assigned to `stage.camera`, the one of its projection —, the announcement of every change and
// every placement of it, and the attaching and letting go of a driver. The stage keeps its
// projection, its container, its view and its pass node, and works out the placement from the
// projection. This module is not in `public-api.ts`: only `Stage2D.ts` reaches it.

import {emitStrict} from '@spearwolf/eventize';
import type {Camera, OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {
  OnStageAfterCameraChanged,
  OnStageCameraPlaced,
  type StageAfterCameraChangedArgs,
  type StageCameraPlacedProps,
} from '../events.js';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {throwCollected} from '../utils/throwCollected.js';
import {CameraProjection} from './CameraProjection.js';
import type {IProjection} from './IProjection.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import type {Stage2D} from './Stage2D.js';
import type {StageCameraDriver} from './StageCameraDriver.js';

/** What a {@link Stage2DCamera} reaches of its stage beyond the public members. @internal */
export interface Stage2DCameraHost {
  /** Hands `camera` to the pass node of the stage and to the run of its post-process, where either exists. */
  takeCamera(camera: Camera): void;
  /** Computes view and camera anew for the container of the last `resize()`; what the projection throws comes out, what a listener or the driver throws goes into `errors`. */
  updateProjection(errors: unknown[]): void;
}

/** @internal */
export class Stage2DCamera {
  readonly #stage: Stage2D;
  readonly #host: Stage2DCameraHost;

  #cameraFromProjection?: Camera;
  #cameraUserOverride?: Camera;

  #driver?: StageCameraDriver;
  // the camera of the driver as the stage last took and announced it: a driver that swaps its
  // camera says so through announceCamera(), and the stage announces the swap with the one it had
  #driverCamera?: Camera;

  #cameraPlacedProps?: StageCameraPlacedProps;

  constructor(stage: Stage2D, host: Stage2DCameraHost) {
    this.#stage = stage;
    this.#host = host;
  }

  /** The camera the stage draws with: the one of the driver, else the assigned one, else the one of the projection. */
  get current(): Camera | undefined {
    return this.#driverCamera ?? this.#cameraUserOverride ?? this.#cameraFromProjection;
  }

  /** The driver attached to the stage. */
  get driver(): StageCameraDriver | undefined {
    return this.#driver;
  }

  /** Takes `camera` as the one assigned to `stage.camera`, `undefined` for none, and announces a change. */
  assign(camera: Camera | undefined, errors: unknown[]): void {
    this.#updateCamera(() => void (this.#cameraUserOverride = camera), errors);
  }

  /** Takes `camera` as the one of the projection, `undefined` for none, and announces a change. */
  setProjectionCamera(camera: Camera | undefined, errors: unknown[]): void {
    this.#updateCamera(() => {
      this.#cameraFromProjection = camera;
    }, errors);
  }

  // whether `camera` is the camera of the projection, built for a kind the projection no longer
  // builds — the source of a CameraProjection that changed its kind: the projection builds a new one.
  // A camera assigned to stage.camera is the caller's, and the projection refuses it instead
  outgrown(projection: IProjection, camera: Camera): boolean {
    return camera === this.#cameraFromProjection && !Stage2DCamera.#buildsKindOf(projection, camera);
  }

  // emits OnStageCameraPlaced with the camera `projection` placed, then lets `driver` compose over
  // what the listeners made of it, also behind one that threw. What the listeners and compose()
  // throw goes into `errors` — an array made on the first error where the caller hands none — and
  // the array comes back: the placement happens after the state stands, so neither undoes it. One
  // props object per stage, rewritten: the code of the placement allocates nothing on a path without
  // an error, and the emit costs what every eventize emit costs, as OnStageUpdateFrame does
  announcePlacement(
    camera: Camera,
    projection: IProjection,
    driver: StageCameraDriver | undefined,
    errors: unknown[] | undefined,
  ): unknown[] | undefined {
    let props = this.#cameraPlacedProps;
    if (props === undefined) {
      props = this.#cameraPlacedProps = {stage: this.#stage, camera, projection};
    } else {
      props.camera = camera;
      props.projection = projection;
    }

    try {
      emitStrict(this.#stage, OnStageCameraPlaced, props);
    } catch (error) {
      (errors ??= []).push(error);
    }
    // a listener that let go of the driver leaves it nothing to compose
    if (driver != null && driver === this.#driver) {
      try {
        driver.compose();
      } catch (error) {
        (errors ??= []).push(error);
      }
    }
    return errors;
  }

  attachDriver(driver: StageCameraDriver): void {
    if (this.#stage.isDisposed) throw new Error('Stage2DInternals.attachDriver(): the stage has been disposed');
    if (this.#driver != null) throw new Error('Stage2DInternals.attachDriver(): the stage has a CameraRig already');

    const errors: unknown[] = [];
    this.#updateCamera(() => {
      this.#driver = driver;
      this.#driverCamera = driver.camera;
    }, errors);
    // the driver composes over a base the projection places for the view the stage has; a listener
    // of the camera change that let go of the driver, or disposed the stage, leaves nothing to place
    if (this.#driver === driver && this.#stage.projection != null && !this.#stage.isDisposed) {
      try {
        this.#host.updateProjection(errors);
      } catch (error) {
        errors.push(error);
      }
    }
    throwCollected(
      errors,
      'Stage2DInternals.attachDriver(): more than one of the listeners of OnStageAfterCameraChanged, OnStageCameraPlaced and OnStageResize, the CameraRig of the stage and the projection threw',
    );
  }

  detachDriver(): void {
    if (this.#driver == null) return;
    // a disposed stage lets go of the driver and keeps the camera it was left with
    if (this.#stage.isDisposed) {
      this.#driver = undefined;
      return;
    }

    // the projection places the camera the stage takes back, and refuses one of a kind it does not
    // build: such a camera is dropped here, not at the next resize()
    const assigned = this.#cameraUserOverride;
    if (assigned != null && !Stage2DCamera.#buildsKindOf(this.#stage.projection, assigned)) {
      this.#cameraUserOverride = undefined;
      // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
      console.warn(
        `Stage2D ${describeValue(this.#stage.name)}: the camera assigned to stage.camera, a ${describeThreeValue(assigned, 'isObject3D')}, is of another kind than its projection builds; the stage drops it as its CameraRig lets go, and draws with a camera of the projection`,
      );
    }

    const errors: unknown[] = [];
    this.#updateCamera(() => {
      this.#driver = undefined;
      this.#driverCamera = undefined;
    }, errors);
    // the camera taken back was not placed while the driver was attached, and a stage without one
    // gets the camera of its projection
    if (this.#stage.projection != null && !this.#stage.isDisposed) {
      try {
        this.#host.updateProjection(errors);
      } catch (error) {
        errors.push(error);
      }
    }
    throwCollected(
      errors,
      'Stage2DInternals.detachDriver(): more than one of the listeners of OnStageAfterCameraChanged, OnStageCameraPlaced and OnStageResize, the CameraRig of the stage and the projection threw',
    );
  }

  announceDriverCamera(): void {
    const driver = this.#driver;
    if (driver == null || this.#stage.isDisposed) return;
    const errors: unknown[] = [];
    this.#updateCamera(() => {
      this.#driverCamera = driver.camera;
    }, errors);
    throwCollected(errors, 'Stage2DInternals.announceCamera(): more than one listener of OnStageAfterCameraChanged threw');
  }

  // the change is made before anyone hears of it, and every listener hears it: what they throw
  // goes into `errors` for the public call to throw once its state stands
  #updateCamera(updateCallback: () => void, errors: unknown[]): void {
    const prevCamera = this.current;
    updateCallback();
    if (prevCamera !== this.current) {
      // a camera that goes away leaves the pass node of the stage the one it had — without a camera
      // the node is not drawn — and the next one goes into it, see takeCamera() of the host in Stage2D
      const camera = this.current;
      if (camera != null) {
        this.#host.takeCamera(camera);
      }
      const args: StageAfterCameraChangedArgs = [this.#stage, prevCamera];
      try {
        emitStrict(this.#stage, OnStageAfterCameraChanged, ...args);
      } catch (error) {
        errors.push(error);
      }
    }
  }

  // whether `projection` places `camera`: each planar projection places the kind it builds, a
  // CameraProjection the kind of its source, and a projection of another class is trusted with any
  // camera
  static #buildsKindOf(projection: IProjection | undefined, camera: Camera): boolean {
    if (projection instanceof ParallaxProjection) return (camera as Partial<PerspectiveCamera>).isPerspectiveCamera === true;
    if (projection instanceof OrthographicProjection) {
      return (camera as Partial<OrthographicCamera>).isOrthographicCamera === true;
    }
    if (projection instanceof CameraProjection) {
      return (projection.source as Partial<PerspectiveCamera>).isPerspectiveCamera === true
        ? (camera as Partial<PerspectiveCamera>).isPerspectiveCamera === true
        : (camera as Partial<OrthographicCamera>).isOrthographicCamera === true;
    }
    return true;
  }
}
