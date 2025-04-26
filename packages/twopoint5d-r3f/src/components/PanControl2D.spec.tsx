import {create} from '@react-three/test-renderer';
import {PanControl2D as __PanControl2D} from '@spearwolf/twopoint5d';
import {describe, expect, it} from 'vitest';
import {PanControl2D} from './PanControl2D.js';

// FIXME Error: R3F: Hooks can only be used within the Canvas component!
// NOTE I think i should stop the support for react-three-fiber - way too much work to maintain all the new versions
//   and the API is changing too fast. I will keep it for now, but I will not support it in the future.

describe.skip('PanControl2D', () => {
  it('create component', async () => {
    const renderer = await create(<PanControl2D pixelsPerSecond={23} />);

    const component = renderer.scene.allChildren[0];

    expect(component).toBeDefined();

    const panControl2D = component.instance as unknown as __PanControl2D;

    expect(panControl2D instanceof __PanControl2D).toBeTruthy();
    expect(panControl2D.pixelsPerSecond).toBe(23);
  });

  it('is active by default', async () => {
    const renderer = await create(<PanControl2D pixelsPerSecond={23} />);

    const panControl2D = renderer.scene.allChildren[0].instance as unknown as __PanControl2D;

    expect(panControl2D.isActive).toBe(true);
    expect(panControl2D.pointerDisabled).toBe(false);
    expect(panControl2D.keyboardDisabled).toBe(false);
  });
});
