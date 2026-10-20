import {add, atan, clamp, div, float, int, max, mul, round, sub} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {cameraPositionLocal} from '../cameraNodes.js';
import {texCoordsFromIndex} from '../node-utils.js';
import {defineFeature, type SpriteFeature} from '../SpriteFeature.js';

export interface TableFrameOptions {
  /**
   * How many views of each frame the table holds — a whole number of 2 or more. The shader adds the view
   * the camera sees the sprite from to `frameIndex`; the kind needs `Yaw` for the facing of the sprite.
   */
  readonly views?: number;
}

export interface TableFrameApi {
  /**
   * The entry of the frame table the sprite shows; with views, the first entry of the block of its views,
   * `frame · views`. Rounded to a whole entry; an entry before the first or past the last frame of the
   * table shows the first or the last frame.
   *
   * `frameIndex` is a static attribute: a later change reaches the gpu once it is marked —
   * `spritePool.touchVO(sprite, 'frameIndex')` or `geometry.touch('frameIndex')` — or with every
   * `update()` in a geometry built with `attributeUsage: {dynamic: ['frameIndex']}`, which suits a frame
   * animated on the CPU.
   */
  frameIndex: number;
}

// one feature per number of views: the graph is built from it, and equal options give the same feature
const features = new Map<number, SpriteFeature<TableFrameApi>>();

// the texels of one frame in the table: tex coords, measures and diagonal flip, trim margins
const TEXELS_PER_FRAME = 3;

/**
 * The view the camera sees the sprite from, `0` to `views − 1`: the angle of the camera about +y of the
 * mesh, counted from +z as `Object3D.rotation.y` turns, less the `yaw` of the sprite, in steps of
 * `2π / views`. View `k` is the camera `k` steps counter-clockwise, seen from above, from the sprite's
 * front. Floored modulo: any yaw, either sign, and the same in WGSL and GLSL.
 */
const viewOf = (
  views: number,
  instancePosition: Node<'vec3'>,
  yaw: Node<'float'>,
  cameraPosition: Node<'vec3'>,
): Node<'float'> => {
  const toCamera = sub(cameraPosition, instancePosition);
  const angle = atan(toCamera.x, toCamera.z);
  const step = round(div(sub(angle, yaw), (2 * Math.PI) / views));
  return sub(step, mul(views, div(step, views).floor())) as unknown as Node<'float'>;
};

/**
 * A frame out of a frame table — the data texture `FrameTable#bakeDataTexture()` bakes, set as the texture
 * `frameTable` — picked by the `frameIndex` of the sprite; with `views`, the view the camera sees the sprite
 * from is added to it. Returns one frozen feature per set of options; `tableFrame()` is {@link TableFrame}.
 *
 * The frame slot reads the header of the table and the three texels of the frame — tex coords, diagonal
 * flip, trim margins — so turned and trimmed frames draw as `AtlasFrame` draws them. Until the table has an
 * image the sprite shows the whole color map.
 *
 * `tableFrame({views: n})` requires `instancePosition` and `yaw`: the `n` views of a frame are `n`
 * consecutive entries of the table, view `k` the camera `k · 360° / n` counter-clockwise, seen from above,
 * from the front of the sprite — which faces `(sin yaw, 0, cos yaw)` in the local space of the mesh, as
 * `Yaw` turns it. The angle lies in the xz plane of the mesh: right for `axisBillboardPlacement()`,
 * `BillboardPlacement` and `flatPlacement({orientation: 'yaw'})`.
 *
 * @throws a `TypeError` for `views` that is no whole number of 2 or more
 */
export function tableFrame(options?: TableFrameOptions): SpriteFeature<TableFrameApi> {
  const views = options?.views;
  if (views !== undefined && !(typeof views === 'number' && Number.isInteger(views) && views >= 2)) {
    throw new TypeError(
      `tableFrame: views must be a whole number of 2 or more, got ${JSON.stringify(views)} — leave views out for frames without views`,
    );
  }
  const key = views ?? 0;
  let feature = features.get(key);
  if (feature == null) {
    feature = defineFeature<TableFrameApi>({
      name: views === undefined ? 'tableFrame' : `tableFrame+views${views}`,
      ...(views === undefined ? {} : {requires: ['instancePosition', 'yaw']}),
      attributes: {frameIndex: {size: 1}},
      textures: {frameTable: {needsImage: true}},
      initialize() {
        this.frameIndex = 0;
      },
      frame: ({attribute, sample, textureSize}) => {
        const size = textureSize('frameTable');
        const lookup = (texel: Node<'int'>) => sample('frameTable', texCoordsFromIndex(size, texel) as unknown as Node<'vec2'>);

        const frameCount = lookup(int(0)).x;
        let index = round(attribute<'float'>('frameIndex')) as unknown as Node<'float'>;
        if (views !== undefined) {
          const view = viewOf(views, attribute<'vec3'>('instancePosition'), attribute<'float'>('yaw'), cameraPositionLocal());
          index = add(index, view) as unknown as Node<'float'>;
        }
        // an entry outside the table shows its first or its last frame
        const entry = clamp(index, float(0), max(sub(frameCount, 1), float(0))).toInt();
        const first = add(mul(entry, TEXELS_PER_FRAME), 1).toInt();

        return {
          texCoords: lookup(first),
          flipDiagonal: lookup(add(first, 1).toInt()).z,
          trim: lookup(add(first, 2).toInt()),
        };
      },
    });
    features.set(key, feature);
  }
  return feature;
}

/** The plain frame out of a frame table, without views: `tableFrame()`. */
export const TableFrame = tableFrame();
