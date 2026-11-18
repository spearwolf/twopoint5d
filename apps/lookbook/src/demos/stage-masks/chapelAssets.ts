import {type TextureAtlas, TextureStore, type TextureStoreData} from '@spearwolf/twopoint5d';
import type {Texture, WebGPURenderer} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';
import {jsonList, jsonNumber, jsonObject, jsonOneOf, jsonRecord, jsonString, jsonTuple} from '~demos/utils/checkJson';
import {fetchJson} from '~demos/utils/fetchAsset';

const DIR = 'stage-masks/frozen';

export interface PaneInfo {
  id: number;
  ring: 'eye' | 'petal' | 'lancet';
  sector: number;
  part: string;
  kind: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  area: number;
}

interface RoseWindowJson {
  texelsPerUnit: number;
  extent: number;
  stoneRadius: number;
  panes: PaneInfo[];
}

export interface HeadJson {
  name: string;
  x: number;
  y: number;
  r: number;
  face: string;
  yaw: number;
  pitch: number;
}

export interface RoomJson {
  extent: number;
  board: {x: number; y: number; w: number; h: number; marks: Record<string, [number, number]>};
  lens: {x: number; y: number};
  candles: {x: number; y: number; size: number}[];
  stands: {x: number; y: number; size: number}[];
  heads: HeadJson[];
  lights: {x: number; y: number; z: number; power: number}[];
}

const checkPaneInfo = jsonObject<PaneInfo>({
  id: jsonNumber,
  ring: jsonOneOf('eye', 'petal', 'lancet'),
  sector: jsonNumber,
  part: jsonString,
  kind: jsonString,
  x0: jsonNumber,
  y0: jsonNumber,
  x1: jsonNumber,
  y1: jsonNumber,
  cx: jsonNumber,
  cy: jsonNumber,
  area: jsonNumber,
});
const checkRoseWindowJson = jsonObject<RoseWindowJson>({
  texelsPerUnit: jsonNumber,
  extent: jsonNumber,
  stoneRadius: jsonNumber,
  panes: jsonList(checkPaneInfo),
});
const checkPoint = jsonObject({x: jsonNumber, y: jsonNumber});
const checkSizedPoint = jsonObject({x: jsonNumber, y: jsonNumber, size: jsonNumber});
const checkHeadJson = jsonObject<HeadJson>({
  name: jsonString,
  x: jsonNumber,
  y: jsonNumber,
  r: jsonNumber,
  face: jsonString,
  yaw: jsonNumber,
  pitch: jsonNumber,
});
const checkRoomJson = jsonObject<RoomJson>({
  extent: jsonNumber,
  board: jsonObject({
    x: jsonNumber,
    y: jsonNumber,
    w: jsonNumber,
    h: jsonNumber,
    marks: jsonRecord(jsonTuple(jsonNumber, jsonNumber)),
  }),
  lens: checkPoint,
  candles: jsonList(checkSizedPoint),
  stands: jsonList(checkSizedPoint),
  heads: jsonList(checkHeadJson),
  lights: jsonList(jsonObject({x: jsonNumber, y: jsonNumber, z: jsonNumber, power: jsonNumber})),
});

/** How the face maps lie in the atlas: what `assets-src/stage-masks/frozen/` writes beside the frames of `sprites.json`. */
interface FaceMap {
  width: number;
  height: number;
  wrap: number;
}

export interface ChapelAssets {
  /** holds the textures; dispose it with the demo */
  store: TextureStore;
  glass: Texture;
  panes: Texture;
  frame: Texture;
  room: Texture;
  sprites: Texture;
  rose: RoseWindowJson;
  layout: RoomJson;
  atlas: TextureAtlas;
  faceMap: FaceMap;
}

// every image of the demo is read upright, t from the top, as the library reads its atlases: the
// seed of the texture factory has flipY false, so the catalog names no default classes. Without a
// colour class an image keeps the NoColorSpace of a new texture: the glass and the ids of the panes
// are data, not colours
const catalog: TextureStoreData = {
  items: {
    glass: {imageUrl: 'glass.webp', texture: ['anisotropy']},
    // the ids of the panes are numbers, not colours: never blended, and without an anisotropy
    // class the texture has none. With both filters NearestFilter three reads level 0 alone, so
    // mip levels of the ids would only take memory
    panes: {imageUrl: 'panes.png', texture: ['nearest', 'no-mipmaps']},
    frame: {imageUrl: 'frame.webp', texture: ['srgb', 'anisotropy']},
    room: {imageUrl: 'room.webp', texture: ['srgb', 'anisotropy']},
    sprites: {atlasUrl: 'sprites.json', texture: ['srgb', 'anisotropy']},
  },
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** The `faceMap` of the json of the atlas, refused unless it carries a width, a height and a wrap. */
function readFaceMap(json: unknown): FaceMap {
  if (typeof json === 'object' && json !== null && 'faceMap' in json) {
    const {faceMap} = json;
    if (typeof faceMap === 'object' && faceMap !== null && 'width' in faceMap && 'height' in faceMap && 'wrap' in faceMap) {
      const {width, height, wrap} = faceMap;
      if (isFiniteNumber(width) && isFiniteNumber(height) && isFiniteNumber(wrap)) return {width, height, wrap};
    }
  }
  throw new Error('MothChapel: sprites.json carries no faceMap with a width, a height and a wrap');
}

/**
 * Loads the generated art of the demo (`assets-src/stage-masks/frozen/`). The store of the answer
 * holds the textures; a load that fails disposes the store it built.
 */
export async function loadChapelAssets(renderer: WebGPURenderer): Promise<ChapelAssets> {
  const store = new TextureStore(renderer);
  try {
    store.parse(catalog, {baseUrl: assetsUrl(`${DIR}/`)});
    const [glass, panes, frame, room, [atlas, sprites], rose, layout] = await Promise.all([
      store.getAsync('glass', 'texture'),
      store.getAsync('panes', 'texture'),
      store.getAsync('frame', 'texture'),
      store.getAsync('room', 'texture'),
      store.getAsync('sprites', ['atlas', 'texture']),
      fetchJson('MothChapel', assetsUrl(`${DIR}/window.json`), checkRoseWindowJson),
      fetchJson('MothChapel', assetsUrl(`${DIR}/room.json`), checkRoomJson),
    ]);
    // the face maps lie beside the frames in the json of the atlas
    const resource = await store.whenResource('sprites');
    const faceMap = readFaceMap('atlasJson' in resource ? resource.atlasJson : undefined);
    return {store, glass, panes, frame, room, sprites, rose, layout, atlas, faceMap};
  } catch (error) {
    store.dispose();
    throw error;
  }
}
