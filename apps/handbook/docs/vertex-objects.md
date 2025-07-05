---
outline: deep
---

# Vertex Objects

`twopoint5d` leverages the concept of **Vertex Objects** to achieve highly efficient 2.5D rendering, especially for scenarios involving a large number of similar graphical elements like sprites or particles. Instead of creating thousands of individual `three.js` Mesh objects, which can incur significant CPU overhead, Vertex Objects allow you to aggregate data for many objects into a single, large `BufferGeometry` instance. This approach minimizes JavaScript-side processing and maximizes GPU throughput by enabling **instanced rendering** with a single WebGL draw call.

Think of Vertex Objects as lightweight, data-driven representations of your individual graphical elements. You define the structure of these elements (their attributes like position, size, color, texture coordinates) once, and then efficiently manipulate their data within shared GPU buffers.

## The VertexObjectDescriptor

The core of defining a Vertex Object is the `VertexObjectDescription` (or `VertexObjectDescriptor` internally). This object describes the layout of the data for each individual "object" within the shared buffer. It's crucial for `twopoint5d` to understand how to interpret and manipulate the data for each instance.

Here's a breakdown of its properties:

```typescript
interface VertexObjectDescription {
  vertexCount?: number;
  indices?: number[];
  meshCount?: number;
  attributes: VertexAttributesType;
  basePrototype?: object | null | undefined;
  methods?: object | null | undefined;
}
```

-   **`vertexCount?: number`**:
    Specifies the number of vertices that make up a single Vertex Object. For a simple quad (like a sprite), this would typically be `4`. If omitted, it defaults to `1`. This is used for non-instanced geometries.

-   **`indices?: number[]`**:
    An optional array of indices that define the triangles for a single Vertex Object. This allows for indexed rendering, which can save memory if vertices are reused (e.g., `[0, 1, 2, 0, 2, 3]` for a quad).

-   **`meshCount?: number`**:
    Used specifically for instanced attributes. If an attribute is defined with `meshCount > 1`, it means that this attribute is shared across `meshCount` instances of the base geometry. This is a more advanced feature for complex instancing scenarios. Defaults to `1`.

-   **`attributes: VertexAttributesType`**:
    This is the most important part. It's an object where keys are the attribute names (e.g., `position`, `color`, `uv`) and values are `VertexAttributeDescription` objects. These descriptions define how each attribute's data is stored in the GPU buffer.

    A `VertexAttributeDescription` can be defined in two ways:

    -   **`components: string[]`**:
        Defines the components of the attribute by name (e.g., `['x', 'y', 'z']` for a 3D position). This automatically sets the `size` of the attribute.

    -   **`size: number`**:
        Defines the number of anonymous components for the attribute (e.g., `3` for a 3-component vector without named accessors).

    Common properties for both `components` and `size` definitions:

    -   **`type?: VertexAttributeDataType`**:
        The data type of the attribute (e.g., `'float32'`, `'uint16'`, `'int8'`). Defaults to `'float32'`.

    -   **`normalized?: boolean`**:
        Whether integer data should be normalized to a float in the range `[0, 1]` or `[-1, 1]` when accessed in the shader. Defaults to `false`.

    -   **`usage?: VertexAttributeUsageType`**:
        Hints to WebGL how the data will be used and updated.
        -   `'static'`: Data is set once and used many times.
        -   `'dynamic'`: Data is changed frequently.
        -   `'stream'`: Data is changed every frame.
        Defaults to `'static'`.

    -   **`autoTouch?: boolean`**:
        If `usage` is `'static'`, `autoTouch` defaults to `false`. Otherwise, it defaults to `true`. When `autoTouch` is `true`, modifying an attribute on a `VO` instance automatically marks the corresponding buffer range as needing an update on the GPU. For `'static'` attributes, you might need to manually call `geometry.touchAttributes()` if you modify them after initial creation.

    -   **`bufferName?: string`**:
        Optional. Allows you to group multiple attributes into the same underlying `THREE.BufferAttribute` (and thus the same `TypedArray` buffer). If not specified, each attribute gets its own buffer.

    -   **`getter?: string | boolean`**:
        Optional. Defines a custom getter for the attribute on the `VO` instance. If `true`, a default getter is created. If a string, it's used as the method name.

    -   **`setter?: string | boolean`**:
        Optional. Defines a custom setter for the attribute on the `VO` instance. If `true`, a default setter is created. If a string, it's used as the method name.

-   **`basePrototype?: object | null | undefined`**:
    An optional prototype object from which the generated Vertex Object instances will inherit. This allows you to extend the functionality of your Vertex Objects with custom methods or properties.

-   **`methods?: object | null | undefined`**:
    An optional object containing methods that will be mixed into the generated Vertex Object instances. This is an alternative to `basePrototype` for adding methods directly.

### Example: Simple Quad Descriptor

```typescript
import { VertexObjectDescription } from '@twopoint5d/twopoint5d/vertex-objects';

const quadDescriptor: VertexObjectDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3], // Two triangles forming a quad

  attributes: {
    position: {
      components: ['x', 'y', 'z'],
      type: 'float32',
    },
    uv: {
      components: ['u', 'v'],
      type: 'float32',
    },
    color: {
      components: ['r', 'g', 'b', 'a'],
      type: 'float32',
      usage: 'dynamic', // Color might change frequently
    },
  },
  methods: {
    // Example method to set position
    setPosition(x: number, y: number, z: number) {
      this.x0_0 = x; // Access component directly
      this.y0_0 = y;
      this.z0_0 = z;
      // ... set other vertices if needed for non-instanced
    },
    // Example method to set color
    setColor(r: number, g: number, b: number, a: number) {
      this.r0_0 = r;
      this.g0_0 = g;
      this.b0_0 = b;
      this.a0_0 = a;
    }
  }
};
```

When `components` are defined, `twopoint5d` automatically generates accessors on the `VO` instance. For example, `position` with `['x', 'y', 'z']` will create `vo.x0_0`, `vo.y0_0`, `vo.z0_0` (for the first vertex of the first mesh). If `vertexCount` is greater than 1, you'll also get `x1_0`, `y1_0`, etc., for subsequent vertices.

## Vertex Object Pools and Geometries

`twopoint5d` provides specialized `BufferGeometry` implementations that work with Vertex Objects and their associated pools.

### `VertexObjectGeometry` (Non-Instanced)

This is used for managing a pool of non-instanced Vertex Objects. Each `VO` in the pool corresponds to a unique set of vertices in the underlying `BufferGeometry`.

```typescript
import { VertexObjectGeometry, VertexObjectDescription } from '@twopoint5d/twopoint5d/vertex-objects';

const myDescriptor: VertexObjectDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {
    position: { components: ['x', 'y', 'z'] },
  },
};

// Create a geometry that can hold up to 1000 Vertex Objects
const geometry = new VertexObjectGeometry(myDescriptor, 1000);

// Get the pool to manage individual Vertex Objects
const pool = geometry.pool;

// Create a new Vertex Object from the pool
const vo1 = pool.createVO();
if (vo1) {
  vo1.x0_0 = 10;
  vo1.y0_0 = 20;
  vo1.z0_0 = 0;
  // ... set other vertex positions for the quad
}

const vo2 = pool.createVO();
if (vo2) {
  vo2.x0_0 = -5;
  vo2.y0_0 = -10;
  vo2.z0_0 = 0;
  // ...
}

// When a VO is no longer needed, free it back to the pool
if (vo1) {
  pool.freeVO(vo1);
}

// You can also retrieve a VO by its index
const retrievedVO = pool.getVO(0); // This might return a different VO if others were freed and re-created
```

### `InstancedVertexObjectGeometry` (Instanced)

This geometry is designed for instanced rendering, where a single base geometry is rendered multiple times with per-instance attributes. It uses two pools: a `basePool` for the shared base geometry (e.g., a single quad) and an `instancedPool` for the per-instance data.

```typescript
import { InstancedVertexObjectGeometry, VertexObjectDescription } from '@twopoint5d/twopoint5d/vertex-objects';
import { BufferGeometry } from 'three';

// Define the base geometry (e.g., a single quad)
const baseGeometry = new BufferGeometry();
baseGeometry.setIndex([0, 1, 2, 0, 2, 3]);
baseGeometry.setAttribute('position', new Float32Array([
  -0.5, -0.5, 0,
   0.5, -0.5, 0,
   0.5,  0.5, 0,
  -0.5,  0.5, 0,
]), 3);

// Define the instanced attributes (per-sprite data)
const instancedDescriptor: VertexObjectDescription = {
  attributes: {
    instancePosition: { components: ['x', 'y', 'z'], usage: 'dynamic' },
    instanceScale: { components: ['sx', 'sy'], usage: 'dynamic' },
    instanceRotation: { size: 1, usage: 'dynamic' }, // single float for rotation
    instanceColor: { components: ['r', 'g', 'b', 'a'], usage: 'dynamic' },
  },
};

// Create an instanced geometry that can render up to 1000 instances
const instancedGeometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseGeometry);

const instancedPool = instancedGeometry.instancedPool;

// Create and configure an instanced Vertex Object
const spriteVO = instancedPool.createVO();
if (spriteVO) {
  spriteVO.x0_0 = 100; // instancePosition.x
  spriteVO.y0_0 = 50;  // instancePosition.y
  spriteVO.z0_0 = 0;   // instancePosition.z

  spriteVO.sx0_0 = 2;  // instanceScale.sx
  spriteVO.sy0_0 = 2;  // instanceScale.sy

  spriteVO.value0_0 = Math.PI / 4; // instanceRotation (using 'value' for single component)

  spriteVO.r0_0 = 1; // instanceColor.r
  spriteVO.g0_0 = 0; // instanceColor.g
  spriteVO.b0_0 = 0; // instanceColor.b
  spriteVO.a0_0 = 1; // instanceColor.a
}
```

Notice how the accessors for instanced attributes are also generated with `_0_0` suffix, indicating the first component of the first instance.

## `TexturedSprites` and `AnimatedSprites` using Vertex Objects

`TexturedSprites` and `AnimatedSprites` are concrete, high-level components within `twopoint5d` that internally utilize `InstancedVertexObjectGeometry` to render many sprites efficiently. They abstract away the direct manipulation of Vertex Objects, providing a more convenient API for common sprite operations.

### `TexturedSprites`

`TexturedSprites` is designed for rendering static sprites from a `TextureAtlas`. It defines a `VertexObjectDescription` that includes attributes necessary for positioning, scaling, rotation, and mapping texture coordinates for each sprite instance.

When you create a `TexturedSprites` instance and add sprites to it, it internally creates and manages `VO` instances from its `instancedPool`. Each sprite you add corresponds to one `VO` in the pool, and its properties (like position, size, and texture frame) are translated into the corresponding `VO` attributes.

### `AnimatedSprites`

`AnimatedSprites` extends `TexturedSprites` by adding support for frame-based animations. Its internal `VertexObjectDescription` includes additional attributes to manage the current animation frame, animation speed, and other animation-related data for each sprite.

When you play an animation on an `AnimatedSprite` instance, `AnimatedSprites` updates the relevant attributes on the underlying `VO` in its `instancedPool` to reflect the current animation frame, which is then used by the shader to display the correct part of the texture atlas.

Both `TexturedSprites` and `AnimatedSprites` demonstrate the power of Vertex Objects: they allow you to define complex rendering logic and manage many instances with minimal performance overhead, all while providing a clean, object-oriented API to the end-user.
