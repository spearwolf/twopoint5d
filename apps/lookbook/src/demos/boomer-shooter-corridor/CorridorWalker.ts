import type {PerspectiveCamera} from 'three/webgpu';
import {CORRIDOR_LENGTH, CORRIDOR_WIDTH} from './Corridor';

const EYE_HEIGHT = 1.65;
const WALK_SPEED = 3.2;
const AUTO_SPEED = 0.9;
const TURN_SPEED = 1.9;
const DRAG_SENSITIVITY = 0.0045;
const MAX_PITCH = 1.25;
const WALL_DISTANCE = 0.5;
// a pointer that moves less than this between down and up clicked, more dragged the view
const CLICK_SLOP = 5;

const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA'],
  right: ['KeyD'],
  turnLeft: ['ArrowLeft', 'KeyQ'],
  turnRight: ['ArrowRight', 'KeyE'],
} as const;

const ALL_KEYS: ReadonlySet<string> = new Set(Object.values(KEYS).flat());

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The first-person camera of the corridor: in autoplay it walks slowly from one door to the other
 * and back, looking about; WASD and the arrow keys walk and turn, a drag looks around, and a click
 * hands its point to {@link onClick}. Any key or drag ends the autoplay.
 */
export class CorridorWalker {
  readonly camera: PerspectiveCamera;

  /** Called with the pointer of a click, in normalized device coordinates of the element. */
  onClick?: (pointer: {x: number; y: number}) => void;

  /** Called when the user takes over and the autoplay ends. */
  onAutoplayChange?: (autoplay: boolean) => void;

  #autoplay = true;
  #yaw = 0;
  #pitch = -0.05;
  #time = 0;
  // the autoplay walks towards −z (−1) or +z (1)
  #direction = -1;
  readonly #pressed = new Set<string>();
  #drag: {id: number; x: number; y: number; startX: number; startY: number; moved: boolean} | undefined;
  readonly #element: HTMLElement;
  readonly #abort = new AbortController();

  constructor(camera: PerspectiveCamera, element: HTMLElement) {
    this.camera = camera;
    this.#element = element;
    camera.rotation.order = 'YXZ';
    camera.position.set(0.4, EYE_HEIGHT, -2.2);

    const {signal} = this.#abort;
    element.addEventListener('pointerdown', (event) => this.#pointerDown(event), {signal});
    element.addEventListener('pointermove', (event) => this.#pointerMove(event), {signal});
    element.addEventListener('pointerup', (event) => this.#pointerUp(event), {signal});
    element.addEventListener('pointercancel', () => (this.#drag = undefined), {signal});
    window.addEventListener('keydown', (event) => this.#key(event, true), {signal});
    window.addEventListener('keyup', (event) => this.#key(event, false), {signal});
    window.addEventListener('blur', () => this.#pressed.clear(), {signal});
  }

  get autoplay(): boolean {
    return this.#autoplay;
  }

  set autoplay(on: boolean) {
    if (on === this.#autoplay) return;
    this.#autoplay = on;
    if (on) {
      // walk on the way the camera looks
      this.#direction = Math.cos(this.#yaw) > 0 ? -1 : 1;
    }
    this.onAutoplayChange?.(on);
  }

  #key(event: KeyboardEvent, down: boolean) {
    if (!ALL_KEYS.has(event.code)) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    if (down) {
      this.#pressed.add(event.code);
      this.autoplay = false;
    } else {
      this.#pressed.delete(event.code);
    }
  }

  #pointerDown(event: PointerEvent) {
    if (event.button !== 0 || this.#drag != null) return;
    this.#drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    this.#element.setPointerCapture(event.pointerId);
  }

  #pointerMove(event: PointerEvent) {
    const drag = this.#drag;
    if (drag == null || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > CLICK_SLOP) {
      drag.moved = true;
      this.autoplay = false;
    }
    if (drag.moved) {
      // mouse look: a drag to the right turns right, a drag down looks down
      this.#yaw -= (event.clientX - drag.x) * DRAG_SENSITIVITY;
      this.#pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.#pitch - (event.clientY - drag.y) * DRAG_SENSITIVITY));
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
  }

  #pointerUp(event: PointerEvent) {
    const drag = this.#drag;
    if (drag == null || drag.id !== event.pointerId) return;
    this.#drag = undefined;
    if (drag.moved) return;
    const rect = this.#element.getBoundingClientRect();
    this.onClick?.({
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    });
  }

  #held(keys: readonly string[]): number {
    return keys.some((key) => this.#pressed.has(key)) ? 1 : 0;
  }

  update(deltaTime: number) {
    this.#time += deltaTime;
    const {position} = this.camera;
    let forward = 0;
    let strafe = 0;
    let speed = WALK_SPEED;
    let bob = 0;

    if (this.#autoplay) {
      const end = this.#direction < 0 ? -CORRIDOR_LENGTH + 6 : -2.5;
      if ((this.#direction < 0 && position.z <= end) || (this.#direction > 0 && position.z >= end)) {
        this.#direction = -this.#direction;
      }
      // looks about as it walks — left and right, now and then down at the floor in front of it
      const heading = this.#direction < 0 ? 0 : Math.PI;
      const look = heading + 0.42 * Math.sin(this.#time * 0.37) + 0.12 * Math.sin(this.#time * 0.83);
      const turn = wrapAngle(look - this.#yaw);
      this.#yaw += turn * Math.min(1, deltaTime * 1.6);
      const lookDown = Math.max(0, Math.sin(this.#time * 0.19 - 1)) ** 2;
      const pitch = -0.04 - 0.45 * lookDown + 0.03 * Math.sin(this.#time * 0.6);
      this.#pitch += (pitch - this.#pitch) * Math.min(1, deltaTime * 2);
      // it walks once it faces its way again, after the turn at the end of the corridor
      const facing = Math.cos(wrapAngle(heading - this.#yaw));
      speed = AUTO_SPEED * Math.max(0, facing);
      // along the corridor, drifting a little from side to side
      position.z += this.#direction * speed * deltaTime;
      position.x += (Math.sin(position.z * 0.13) * 0.9 - position.x) * Math.min(1, deltaTime * 0.5);
      bob = speed;
    } else {
      this.#yaw += (this.#held(KEYS.turnLeft) - this.#held(KEYS.turnRight)) * TURN_SPEED * deltaTime;
      forward = this.#held(KEYS.forward) - this.#held(KEYS.back);
      strafe = this.#held(KEYS.right) - this.#held(KEYS.left);
      const length = Math.hypot(forward, strafe);
      if (length > 0) {
        // the camera looks along −z at a yaw of 0: forward is (−sin yaw, −cos yaw), right (cos yaw, −sin yaw)
        const step = (speed * deltaTime) / length;
        const sin = Math.sin(this.#yaw);
        const cos = Math.cos(this.#yaw);
        position.x += (-sin * forward + cos * strafe) * step;
        position.z += (-cos * forward - sin * strafe) * step;
        bob = speed * 0.5;
      }
    }

    position.x = Math.max(-CORRIDOR_WIDTH / 2 + WALL_DISTANCE, Math.min(CORRIDOR_WIDTH / 2 - WALL_DISTANCE, position.x));
    position.z = Math.max(-CORRIDOR_LENGTH + WALL_DISTANCE, Math.min(-WALL_DISTANCE, position.z));
    position.y = EYE_HEIGHT + (bob > 0 ? Math.abs(Math.sin(this.#time * 5.5)) * 0.035 : 0);
    this.camera.rotation.set(this.#pitch, this.#yaw, 0);
    this.camera.updateMatrixWorld();
  }

  dispose() {
    this.#abort.abort();
  }
}
