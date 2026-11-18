import {Vector2} from 'three/webgpu';
import {describe, expect, it} from 'vitest';
import {type CrawlLayout, CrawlRig} from './CrawlRig';

const layer = {z: 0, ppu: 1, left: -10, right: 10, bottom: -10, top: 10, tiles: 1, images: []};

const layout: CrawlLayout = {
  cameraDistance: 500,
  floorY: -150,
  playerRange: 400,
  cameraRange: 300,
  layers: {back: layer, mid: layer, play: layer},
  vent: {x: 0, y: 100, hw: 20, hh: 10},
  posts: [],
  drain: {y: 0, drip: 1},
  drawings: [],
  near: [],
  eyes: [],
  lens: {x: 88, y: 4},
  frames: {},
};

describe('CrawlRig', () => {
  it('aims the beam at the pointer from the lens, where the layout puts it', () => {
    const rig = new CrawlRig(layout);
    // a point up and ahead of the lens at 45 degrees, and the pointer that lies over it
    const aimAt = new Vector2(rig.lens.x + 100, rig.lens.y + 100);
    rig.input.pointer = new Vector2((aimAt.x - rig.camera.x) / rig.view.x, (aimAt.y - rig.camera.y) / rig.view.y);
    rig.update(1 / 60);
    expect(rig.aim).toBeCloseTo(Math.PI / 4, 9);
  });
});
