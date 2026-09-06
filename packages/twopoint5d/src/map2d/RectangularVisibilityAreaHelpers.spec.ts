import {Object3D} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import type {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import {RectangularVisibilityAreaHelpers} from './RectangularVisibilityAreaHelpers.js';

// update() reads the width and the height of the area and nothing else
function makeArea(): RectangularVisibilityArea {
  return {width: 640, height: 480} as unknown as RectangularVisibilityArea;
}

describe('RectangularVisibilityAreaHelpers', () => {
  test('builds no helper while no scene has been handed over', () => {
    const helpers = new RectangularVisibilityAreaHelpers(makeArea());

    expect(() => {
      helpers.show = true;
      helpers.update();
    }, 'a helper with nowhere to go is not built').not.toThrow();

    const scene = new Object3D();
    helpers.add(scene);
    helpers.update();

    expect(scene.children, 'and the scene gets its helper once it is there').toHaveLength(1);
  });
});
