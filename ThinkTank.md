
## Vertex Object Descriptors

### Define

```js
{
    vertexCount: 4,
    indices: [0, 1, 2, 0, 2, 3],        // [optional]

    meshCount: 1,                       // for instanced attributes
                                        // open question: VertexBufferObject <- capacity <- meshCount > 1 ?
    attributes: {
        position: {
            components: ['x', 'y', 'z'],                // either components ..
            size: 3,                                    // .. or size

            type: 'float32',                            // [optional] the default type is float32
            normalized: boolean,                        // [optional] default is not

            usage: 'static' | 'dynamic' | 'stream',     // [optional] default is 'static'
            autoTouch: true                             // [optional] default 'static' is false otherwise true

            // buffer -> {vertexCount}{meshCount}{usage}{normalized}{autoTouch}_{+optional:bufferName}?
         }
    }

    prototpe: MyBaseClass.prototype;  // [optional]

    methods: {
        [methodName]() {}
    }
}
```

### API

```js

const geometry = new VertexObjectGeometry(descriptor, CAPACITY = 1);
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, CAPACITY_INSTANCED, baseDescriptor, CAPACITY_BASE = 1);
//const geometry = new InstancedVertexObjectGeometry([instancedDescriptor], CAPACITY_INSTANCED, baseDescriptor, CAPACITY_BASE = 1);
//const geometry = new InstancedVertexObjectGeometry({foo: instancedDescriptor}, CAPACITY_INSTANCED, baseDescriptor, CAPACITY_BASE = 1);
// -> VertexObjectDescriptor.merge(...) ?

const vo = geometry.pool.createVO(target)
const vos = geometry.pool.createBatchVO(1000, target?)

const batch = geometry.pool.createBatchVO(1000) // ?
batch.freeAll()

const vo = geometry.pool.createVO()
const vo = geometry.instancedPool.createVO()
//const vo = geometry.instancedPools[0].createVO()

//const vo = geometry.getPool().createVO()
//const vo = geometry.getPool(0).createVO()
//const vo = geometry.getPool('foo').createVO()

vo.setPosition()
vo.x0_0
vo.x1_0
vo.x3_0
vo.x0_1

vo.copy(vo)

geometry.pool.freeVO(vo)
//geometry.basePool.freeVO(vo)
geometry.instancedPool.freeVO(vo)

geometry.touchAttributes('position', 'foo')
geometry.touchBuffers({dynamic: false, stream: true, static: false})
// geometry.touch(true) // => touch all
geometry.update()

```
