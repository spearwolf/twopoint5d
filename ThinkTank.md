
## Vertex Object Descriptors

### Define

```js
{
    vertexCount: 4,
    indices: [0, 1, 2, 0, 2, 3],        // [optional]

    meshCount: 1,                       // for instanced attributes (use instead of vertexCount)
                                        // not yet fully thought through: VertexBufferObject <- capacity <- meshCount > 1 ?
    attributes: {
        position: {                                     // attribute name
            components: ['x', 'y', 'z'],                // either define components ..
            size: 3,                                    // .. or set number of anonymous components

            type: 'float32',                            // [optional] the default type is float32
            normalized: boolean,                        // [optional] default is not

            usage: 'static' | 'dynamic' | 'stream',     // [optional] default is 'static'
            autoTouch: true                             // [optional] if usage == 'static' then default is false otherwise true

            // buffer -> {vertexCount}{meshCount}{usage}{normalized}{autoTouch}_{+optional:bufferName}?
            // TODO implement bufferName ?
         }
    }

    prototpe: MyBaseClass.prototype;  // [optional]

    methods: {  // TODO not yet implemented
        [methodName]() {}
    }
}
```

### API

```js

const geometry = new VertexObjectGeometry(descriptor, CAPACITY = 1);

const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, INSTANCED_CAPACITY, baseDescriptor, BASE_CAPACITY = 1);
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, INSTANCED_CAPACITY, baseBufferGeometry);

const vo = geometry.pool.createVO()  // VertexObjectGeometry

const vo = geometry.basePool.createVO()       // InstancedVertexObjectGeometry
const vo = geometry.instancedPool.createVO()

vo.setPosition([...])
vo.x0_0
vo.x1_0
vo.x3_0
vo.x0_1

vo.copy(vo)

geometry.pool.freeVO(vo)
geometry.basePool.freeVO(vo)
geometry.instancedPool.freeVO(vo)

geometry.touchAttributes('position', 'foo')
geometry.touchBuffers({dynamic: false, stream: true, static: false})
geometry.touch('position', {dynamic: true}, ...)  // yes, you can mix it here if you want

geometry.update()  // automatically called by VertexObjects

const mesh = new VertexObjects(geometry, material)
mesh.frustumCalled = false  // can be very helpful in the development ;)
scene.add(mesh)
```
