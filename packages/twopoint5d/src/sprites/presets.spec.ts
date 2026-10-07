import {describe, expect, test} from 'vitest';

import {VertexObjectDescriptor} from '../vertex-objects/VertexObjectDescriptor.js';
import {AnimatedSpriteKind, TexturedSpriteKind} from './presets.js';

describe('the presets', () => {
  test('TexturedSpriteKind keeps the attributes of the textured sprites, in their buffers and order', () => {
    const descriptor = new VertexObjectDescriptor(TexturedSpriteKind.description);

    expect(descriptor.attributeNames).toEqual([
      'instancePosition',
      'quadSize',
      'rotation',
      'texCoords',
      'texFlipDiagonal',
      'texTrim',
      'color',
    ]);
    expect(Object.fromEntries([...descriptor.attributes].map(([name, a]) => [name, a.bufferName]))).toEqual({
      instancePosition: 'dynamic_float32',
      quadSize: 'static_float32',
      rotation: 'dynamic_float32',
      texCoords: 'static_float32',
      texFlipDiagonal: 'static_float32',
      texTrim: 'static_float32',
      color: 'static_float32',
    });
    expect(TexturedSpriteKind.usageAliases).toEqual({
      position: ['instancePosition'],
      size: ['quadSize'],
      texCoords: ['texFlipDiagonal', 'texTrim'],
    });
  });

  test('AnimatedSpriteKind keeps the attributes of the animated sprites and has no tint', () => {
    const descriptor = new VertexObjectDescriptor(AnimatedSpriteKind.description);

    expect(descriptor.attributeNames).toEqual(['instancePosition', 'quadSize', 'rotation', 'anim']);
    expect(AnimatedSpriteKind.features.map((f) => f.name)).not.toContain('tint');
  });
});
