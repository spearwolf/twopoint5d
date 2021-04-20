
## Vertex Object Descriptors

### Define

```js

{
    vertexCount: 4,
    indices: [0, 1, 2, 0, 2, 3],        // optional

    meshCount: 1,                       // for instanced attributes

    attributes: {
        position: {
            components: ['x', 'y', 'z'],                // either components ..
            size: 3,                                    // .. or size
            type: 'float32',                            // [optional] the default type
            usage: 'static' | 'dynamic' | 'stream',     // [optional] default is 'static'
            get: () => any,                             // [optional] getter ? 'setPosition(...)'
            set: (...args: any[]) => void,              // [optional] setter ? 'getPosition(...)'
            // buffer -> {vertexCount}{meshCount}{usage}{type}
         }
    }

    methods: {
        [methodName]() {}
    }
}

```

### API

```js

const geometry = new VertexObjectGeometry(descriptor, CAPACITY = 1);
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, CAPACITY_INSTANCED, baseDescriptor, CAPACITY_BASE = 1);

const vo = geometry.pool.createVO()
const vo = geometry.basePool.createVO()
const vos = geometry.instancedPool.createVOs(1000);

vo.setPosition()
vo.x0_0
vo.x1_0
vo.x3_0
vo.x0_1

vo.copy(vo)

geometry.pool.freeVO(vo)
geometry.basePool.freeVO(vo)
geometry.instancedPool.freeVOs(vos)

```

