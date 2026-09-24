import {describe, expect, it} from 'vitest';
import * as displayApi from './public-api.js';

describe('display public API', () => {
  it('exports the classes and functions of the display module and nothing else', () => {
    expect(Object.keys(displayApi).sort()).toEqual([
      'Chronometer',
      'Display',
      'FixedFrameLoop',
      'FrameLoop',
      'Stylesheets',
      'getContentAreaSize',
      'isWebGLRenderer',
      'isWebGPURenderer',
    ]);
  });
});
