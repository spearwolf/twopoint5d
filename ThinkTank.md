
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

            // setterName: 'setPosition' ?                 // [optional]
            // getterName: 'getPosition' ?                 // [optional]
            // get: () => any,                             // [optional] getter ? 'setPosition(...)'
            // set: (...args: any[]) => void,              // [optional] setter ? 'getPosition(...)'

            // buffer -> {vertexCount}{meshCount}{usage}{normalized}_{+optional:bufferName}?
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
const geometry = new InstancedVertexObjectGeometry([instancedDescriptor], CAPACITY_INSTANCED, baseDescriptor, CAPACITY_BASE = 1);
const geometry = new InstancedVertexObjectGeometry({foo: instancedDescriptor}, CAPACITY_INSTANCED, baseDescriptor, CAPACITY_BASE = 1);

const vo = geometry.vertexObjects.createVO(target)
const vos = geometry.vertexObjects.createVOs(1000, targets)

const group = geometry.vertexObjects.createGroup(1000) // ?
group.free()

const vo = geometry.baseVertexObjects.createVO()
const vo = geometry.instancedVertexObjects.createVO()

const vo = geometry.getVertexObjects().createVO()
const vo = geometry.getVertexObjects('foo').createVO()

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
