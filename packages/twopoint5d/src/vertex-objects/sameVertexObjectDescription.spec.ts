import {describe, expect, test} from 'vitest';

import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {sameVertexObjectDescription} from './sameVertexObjectDescription.js';
import type {VAComponentsDescription, VertexObjectDescription} from './types.js';

function shine() {}

class Sprite {}

const make = (): VertexObjectDescription => ({
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {
    pos: {components: ['x', 'y'], type: 'float32', usage: 'dynamic'},
    glow: {size: 1, bufferName: 'glowBuffer'},
  },
  methods: {shine},
  basePrototype: Sprite.prototype,
});

// the attribute descriptions are written to through these, whichever of the two shapes they declare
const glowOf = (d: VertexObjectDescription) => d.attributes['glow'] as unknown as Record<string, unknown>;
const posOf = (d: VertexObjectDescription) => d.attributes['pos'] as VAComponentsDescription;

describe('sameVertexObjectDescription()', () => {
  test('a description is the same as the copy a descriptor holds of it', () => {
    const d = make();
    const frozen = new VertexObjectDescriptor(d).description;

    expect(sameVertexObjectDescription(d, frozen)).toBe(true);
  });

  test('a second object of the same content is the same', () => {
    expect(sameVertexObjectDescription(make(), new VertexObjectDescriptor(make()).description)).toBe(true);
  });

  test('a description without indices and methods is the same as its copy', () => {
    const d = make();
    delete d.indices;
    delete d.methods;
    const frozen = new VertexObjectDescriptor(d).description;

    expect(sameVertexObjectDescription(d, frozen)).toBe(true);
  });

  test.each<[string, (d: VertexObjectDescription) => void]>([
    ['vertexCount 4 → 8', (d) => (d.vertexCount = 8)],
    ['an index changed', (d) => (d.indices![1] = 3)],
    ['an index appended', (d) => d.indices!.push(0)],
    ['indices deleted', (d) => delete d.indices],
    ['an attribute added', (d) => (d.attributes['extra'] = {size: 1})],
    ['an attribute deleted', (d) => delete d.attributes['glow']],
    [
      'the same two attributes in reverse order',
      (d) => (d.attributes = {glow: d.attributes['glow']!, pos: d.attributes['pos']!}),
    ],
    ['size of glow changed', (d) => (glowOf(d)['size'] = 2)],
    ['type of glow set', (d) => (glowOf(d)['type'] = 'uint32')],
    ['normalized of glow set', (d) => (glowOf(d)['normalized'] = true)],
    ['usage of glow set', (d) => (glowOf(d)['usage'] = 'stream')],
    ['autoTouch of glow set', (d) => (glowOf(d)['autoTouch'] = true)],
    ['bufferName of glow changed', (d) => (glowOf(d)['bufferName'] = 'otherBuffer')],
    ['getter of glow set', (d) => (glowOf(d)['getter'] = 'readGlow')],
    ['setter of glow set', (d) => (glowOf(d)['setter'] = 'writeGlow')],
    // the key alone changes the descriptor: VertexAttributeDescriptor#getterName asks `'getter' in description`
    ['getter: undefined set on glow', (d) => (glowOf(d)['getter'] = undefined)],
    ['a component renamed', (d) => (posOf(d).components[1] = 'z')],
    ['a component appended', (d) => posOf(d).components.push('z')],
    ['basePrototype replaced by another object', (d) => (d.basePrototype = {})],
    ['a method replaced by another function', (d) => (d.methods = {shine: () => {}})],
    ['a method added', (d) => (d.methods = {shine, glare() {}})],
    ['methods deleted', (d) => delete d.methods],
  ])('%s is not the same', (_, change) => {
    const d = make();
    const frozen = new VertexObjectDescriptor(d).description;

    change(d);

    expect(sameVertexObjectDescription(d, frozen)).toBe(false);
  });
});
