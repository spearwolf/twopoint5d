import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';

describe('Stage2D', () => {
  it('has a scene by default', () => {
    const stage = new Stage2D(new ParallaxProjection('xz|top-left', {fit: 'contain', width: 600}));
    expect(stage.scene).toBeDefined();
  });

  it('after call to resize() a camera is created (by projection)', () => {
    const stage = new Stage2D(new ParallaxProjection('xz|top-left', {pixelZoom: 2}));
    stage.resize(320, 240);

    expect(stage.camera).toBeDefined();
  });
});
