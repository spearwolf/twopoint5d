import {createSandbox} from 'sinon';
import {afterEach, describe, expect, test} from 'vitest';

import cloneVertexObjectDescription from './cloneVertexObjectDescription.js';
import type {VAComponentsType, VASizeType, VertexObjectDescription} from './types.js';

describe('cloneVertexObjectDescription', () => {
  const desc0: VertexObjectDescription = {
    vertexCount: 4,
    indices: [0, 1, 2, 0, 2, 3],

    attributes: {
      position: {
        components: ['x', 'y', 'z'],
        type: 'float32',
      },
    },
  };

  const desc1: VertexObjectDescription = {
    meshCount: 1,

    attributes: {
      color: {
        components: ['r', 'g', 'b'],
        type: 'float32',
        usage: 'dynamic',
      },
      strength: {
        size: 1,
        type: 'float32',
        usage: 'static',
      },
      impact: {
        size: 1,
        type: 'uint32',
        usage: 'dynamic',
      },
    },
  };

  const desc2: VertexObjectDescription = {
    meshCount: 1,

    attributes: {
      instancePosition: {
        components: ['x', 'y', 'z'],
        type: 'float32',
        usage: 'stream',
      },
    },
  };

  class Foo {
    foo() {
      return 'foo';
    }
  }

  function bar() {
    return 'bar';
  }

  const desc3: VertexObjectDescription = {
    meshCount: 1,

    attributes: {
      position: {
        components: ['x', 'y', 'z'],
        type: 'float32',
        usage: 'stream',
      },
    },

    basePrototype: Foo.prototype,

    methods: {
      bar,
    },
  };

  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('desc0 without attribute usage change', () => {
    const clonedDesc = cloneVertexObjectDescription(desc0);

    expect(clonedDesc).not.toBe(desc0);
    expect(clonedDesc.vertexCount).toBe(4);

    expect(clonedDesc.indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(clonedDesc.indices).not.toBe(desc0.indices);

    const posAttr = clonedDesc.attributes['position'] as VAComponentsType;

    expect(posAttr.components).toEqual(['x', 'y', 'z']);
    expect(posAttr.components).not.toBe((desc0.attributes['position'] as VAComponentsType).components);
    expect(posAttr.type).toBe('float32');
    expect(posAttr.usage).toBeUndefined();
  });

  test('desc0 with attribute usage change', () => {
    const clonedDesc = cloneVertexObjectDescription(desc0, {
      dynamic: ['position'],
    });

    expect(clonedDesc).not.toBe(desc0);
    expect(clonedDesc.vertexCount).toBe(4);

    expect(clonedDesc.indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(clonedDesc.indices).not.toBe(desc0.indices);

    const posAttr = clonedDesc.attributes['position'] as VAComponentsType;

    expect(posAttr.components).toEqual(['x', 'y', 'z']);
    expect(posAttr.components).not.toBe((desc0.attributes['position'] as VAComponentsType).components);
    expect(posAttr.type).toBe('float32');
    expect(posAttr.usage).toBe('dynamic');
  });

  test('desc1 without attribute usage change', () => {
    const clonedDesc = cloneVertexObjectDescription(desc1);

    expect(clonedDesc).not.toBe(desc1);
    expect(clonedDesc.meshCount).toBe(1);

    const colorAttr = clonedDesc.attributes['color'] as VAComponentsType;

    expect(colorAttr.components).toEqual(['r', 'g', 'b']);
    expect(colorAttr.components).not.toBe((desc1.attributes['color'] as VAComponentsType).components);
    expect(colorAttr.type).toBe('float32');
    expect(colorAttr.usage).toBe('dynamic');

    const strengthAttr = clonedDesc.attributes['strength'] as VASizeType;

    expect(strengthAttr.size).toBe(1);
    expect(strengthAttr.type).toBe('float32');
    expect(strengthAttr.usage).toBe('static');

    const impactAttr = clonedDesc.attributes['impact'] as VASizeType;

    expect(impactAttr.size).toBe(1);
    expect(impactAttr.type).toBe('uint32');
    expect(impactAttr.usage).toBe('dynamic');
  });

  test('desc1 with attribute usage change (leave impact as it is)', () => {
    const clonedDesc = cloneVertexObjectDescription(desc1, {
      dynamic: ['strength'],
      stream: ['color'],
    });

    expect(clonedDesc).not.toBe(desc1);
    expect(clonedDesc.meshCount).toBe(1);

    const colorAttr = clonedDesc.attributes['color'] as VAComponentsType;

    expect(colorAttr.components).toEqual(['r', 'g', 'b']);
    expect(colorAttr.components).not.toBe((desc1.attributes['color'] as VAComponentsType).components);
    expect(colorAttr.type).toBe('float32');
    expect(colorAttr.usage).toBe('stream');

    const strengthAttr = clonedDesc.attributes['strength'] as VASizeType;

    expect(strengthAttr.size).toBe(1);
    expect(strengthAttr.type).toBe('float32');
    expect(strengthAttr.usage).toBe('dynamic');

    const impactAttr = clonedDesc.attributes['impact'] as VASizeType;

    expect(impactAttr.size).toBe(1);
    expect(impactAttr.type).toBe('uint32');
    expect(impactAttr.usage).toBe('dynamic');
  });

  test('desc1 with attribute usage change (change impact to static)', () => {
    const clonedDesc = cloneVertexObjectDescription(desc1, {
      static: ['impact'],
    });

    expect(clonedDesc).not.toBe(desc1);

    const impactAttr = clonedDesc.attributes['impact'] as VASizeType;

    expect(impactAttr.size).toBe(1);
    expect(impactAttr.type).toBe('uint32');
    expect(impactAttr.usage).toBe('static');
  });

  test('desc1 without attributes will not change any usage', () => {
    const clonedDesc = cloneVertexObjectDescription(desc1, {
      dynamic: [],
      alias: {
        color: ['impact'],
      },
    });

    expect(clonedDesc).not.toBe(desc1);

    const colorAttr = clonedDesc.attributes['color'] as VAComponentsType;
    expect(colorAttr.usage).toBe('dynamic');

    const strengthAttr = clonedDesc.attributes['strength'] as VASizeType;
    expect(strengthAttr.usage).toBe('static');

    const impactAttr = clonedDesc.attributes['impact'] as VASizeType;
    expect(impactAttr.usage).toBe('dynamic');
  });

  test('desc2 with attribute alias', () => {
    const clonedDesc = cloneVertexObjectDescription(desc2, {
      dynamic: ['position'],
      alias: {
        position: ['instancePosition'],
      },
    });

    expect(clonedDesc).not.toBe(desc2);
    expect(clonedDesc.meshCount).toBe(1);

    const posAttr = clonedDesc.attributes['instancePosition'] as VAComponentsType;

    expect(posAttr.components).toEqual(['x', 'y', 'z']);
    expect(posAttr.components).not.toBe((desc2.attributes['instancePosition'] as VAComponentsType).components);
    expect(posAttr.type).toBe('float32');
    expect(posAttr.usage).toBe('dynamic');
  });

  test('desc3 basePrototype remains the same', () => {
    const clonedDesc = cloneVertexObjectDescription(desc3, {
      dynamic: ['position'],
    });

    expect(clonedDesc).not.toBe(desc3);
    expect(clonedDesc.meshCount).toBe(1);

    const posAttr = clonedDesc.attributes['position'] as VAComponentsType;

    expect(posAttr.components).toEqual(['x', 'y', 'z']);
    expect(posAttr.components).not.toBe((desc3.attributes['position'] as VAComponentsType).components);
    expect(posAttr.type).toBe('float32');
    expect(posAttr.usage).toBe('dynamic');

    expect(clonedDesc.basePrototype).toBe(Foo.prototype);
  });

  test('desc3 methods is a new object but all methods remain the same instances', () => {
    const clonedDesc = cloneVertexObjectDescription(desc3);

    expect(clonedDesc).not.toBe(desc3);

    expect(clonedDesc.methods).not.toBe(desc3.methods);
    expect((clonedDesc.methods as any).bar).toBe(bar);
  });
});
