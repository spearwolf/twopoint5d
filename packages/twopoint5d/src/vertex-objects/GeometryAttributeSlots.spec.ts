import {BufferAttribute, BufferGeometry} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {type AttributeRoute, GeometryAttributeSlots} from './GeometryAttributeSlots.js';

// attachInstancedPool() reaches the first two branches of withdrawRoute() never, because it refuses
// every name the geometry has held before; the class keeps its contract without that guard

describe('GeometryAttributeSlots#withdrawRoute()', () => {
  const setup = () => {
    const geometry = new BufferGeometry();
    const slots = new GeometryAttributeSlots();
    const routeA: AttributeRoute = new Map();
    const routeB: AttributeRoute = new Map();
    const attrA = new BufferAttribute(new Float32Array(3), 1);
    const attrB = new BufferAttribute(new Float32Array(3), 1);
    return {geometry, slots, routeA, routeB, attrA, attrB};
  };

  test('withdrawRoute() of the topmost claim puts the claim underneath back into the slot and keeps its name held', () => {
    const {geometry, slots, routeA, routeB, attrA, attrB} = setup();
    slots.claim('a', routeA, attrA);
    geometry.setAttribute('a', attrA);
    slots.claim('a', routeB, attrB);
    geometry.setAttribute('a', attrB);

    slots.withdrawRoute(geometry, routeB);

    expect(geometry.getAttribute('a')).toBe(attrA);
    expect(slots.everHeld(['a'])).toEqual(['a']);
  });

  test('withdrawRoute() of a claim underneath leaves the slot as it shows', () => {
    const {geometry, slots, routeA, routeB, attrA, attrB} = setup();
    slots.claim('a', routeA, attrA);
    geometry.setAttribute('a', attrA);
    slots.claim('a', routeB, attrB);
    geometry.setAttribute('a', attrB);

    slots.withdrawRoute(geometry, routeA);

    expect(geometry.getAttribute('a')).toBe(attrB);

    // no claim of route A is left underneath, so the release of route B empties the slot
    slots.releaseRoute(geometry, routeB);

    expect(geometry.getAttribute('a')).toBeUndefined();
  });

  test('withdrawRoute() of the only claim forgets the name', () => {
    const {geometry, slots, routeA, attrA} = setup();
    slots.claim('a', routeA, attrA);
    geometry.setAttribute('a', attrA);

    slots.withdrawRoute(geometry, routeA);

    expect(geometry.getAttribute('a')).toBeUndefined();
    expect(slots.everHeld(['a'])).toEqual([]);
  });
});
