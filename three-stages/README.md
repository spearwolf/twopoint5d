# three-stages

is a three.js companion library that make ist easy to create a 2D _stage_ with a _projection_.

it's based on the [three-vertex-objects](https://github.com/spearwolf/three-vertex-objects/tree/master/three-vertex-objects) library which itself is build upon [three.js](https://threejs.org/)

## Projection

the projection simplifies the use of a [THREE.Camera](https://threejs.org/docs/#api/en/cameras/Camera) in a two dimensional responsive design aware pixelart context. you ever wanted a perspective camera that shows a resolution of 640x480 in the canvas, but respecting the ["object-fit: contain"](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) rules within the viewport, ideally with the origin in the upper left corner? then you should try the [[ParallaxProjection]] or the [[OrthographicProjection]].
