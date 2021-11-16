# @spearwolf/three-vertex-objects

## Vertex Objects

### 1. Create Geometry


#### Non-instanced Vertex Objects

```ts
import { VertexObjectDescription, VertexObjectGeometry } from '@spearwolf/three-vertex-object';

const descriptor: VertexObjectDescription = {
	vertexCount: 4,
	indices: [0, 1, 2, 0, 2, 3],

	attributes: {
		position: {
			components: ['x', 'y', 'z'],
			type: 'float32',
		},
	},
};

// create a geometry with 1000 vertex objects
const geometry = new VertexObjectGeometry(descriptor, 1000);

geometry.pool  // => VertexObjectPool
```

#### Instanced Vertex Objects

```ts
import { VertexObjectDescription, InstancedVertexObjectGeometry } from '@spearwolf/three-vertex-object';

const baseDescriptor: VertexObjectDescription = {
	vertexCount: 4,
	indices: [0, 1, 2, 0, 2, 3],

	attributes: {
		position: {
			components: ['x', 'y', 'z'],
			type: 'float32',
		},
	},
};

const instancedDescriptor: VertexObjectDescription = {
	meshCount: 1,

	attributes: {
		color: {
			components: ['r', 'g', 'b'],
			type: 'float32',
			usage: 'dynamic',
		},
	},
};

// create a geometry with one base object and 1000 instanced objects
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);

geometry.basePool       // => VertexObjectPool
geometry.instancedPool  // => VertexObjectPool
```


### 2. Create Material

No special THREE.Material is needed.
But in most cases you will want to create your own custom shader material specifically adapted to your vertex object properties.

```js
const material = new THREE.ShaderMaterial({ vertexShader, fragmentShgader, uniforms... });
```


### 3. Create Mesh

`VertexObjects` is a simple wrapper that derives from `THREE.Mesh` and ensures that your vertex-object-geometry is updated before each render (but only if this is necessary).

```js
import { VertexObjects } from '@spearwolf/three-vertex-object';

const mesh = new VertexObjects(geometry, material);

mesh.geometry  // => VertexObjectGeometry | InstancedVertexObjectGeometry
mesh.material

scene.add(mesh);
```
