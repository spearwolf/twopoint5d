// The JSON and text layouts the outputs are written in. Each follows the documented export of the
// tool it names, field by field, so that a reader of that tool's files reads ours.

/** @typedef {import('./pack.mjs').PackedFrame} PackedFrame */

/**
 * @param {PackedFrame} f
 */
function frameEntry(f) {
  return {
    frame: {x: f.x, y: f.y, w: f.w, h: f.h},
    rotated: false,
    trimmed: f.trimmed,
    spriteSourceSize: f.spriteSourceSize,
    sourceSize: f.sourceSize,
  };
}

/**
 * TexturePacker "JSON (Hash)", the layout of the atlases already in `public/assets/`.
 * @param {PackedFrame[]} frames in the order they appear in the file
 * @param {{image: string, width: number, height: number}} sheet
 */
export function texturePackerHash(frames, sheet) {
  return {
    frames: Object.fromEntries(frames.map((f) => [f.name, frameEntry(f)])),
    meta: {image: sheet.image, format: 'RGBA8888', size: {w: sheet.width, h: sheet.height}, scale: '1'},
  };
}

/**
 * free-tex-packer's "JSON (hash)" exporter, as free-tex-packer-core 0.3.9 writes it: the
 * TexturePacker layout plus a `pivot` per frame (always the centre), a numeric `scale` and the
 * packer in `meta.app`. Frames in the order they were packed, which is their order in the sheet,
 * row by row.
 * @param {PackedFrame[]} frames
 * @param {{image: string, width: number, height: number}} sheet
 */
export function freeTexPackerHash(frames, sheet) {
  const sorted = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);
  return {
    frames: Object.fromEntries(sorted.map((f) => [f.name, {...frameEntry(f), pivot: {x: 0.5, y: 0.5}}])),
    meta: {
      app: 'http://github.com/odrick/free-tex-packer-core',
      version: '0.3.9',
      image: sheet.image,
      format: 'RGBA8888',
      size: {w: sheet.width, h: sheet.height},
      scale: 1,
    },
  };
}

/**
 * @typedef {object} AsepriteTag
 * @property {string} name
 * @property {number} from first frame, inclusive
 * @property {number} to last frame, inclusive
 * @property {'forward' | 'reverse' | 'pingpong' | 'pingpong_reverse'} direction
 * @property {string} [color] `#rrggbbaa`
 */

/**
 * @typedef {object} AsepriteSliceKey
 * @property {number} frame the first frame the key applies to
 * @property {{x: number, y: number, w: number, h: number}} bounds in sprite (untrimmed) pixels
 * @property {{x: number, y: number, w: number, h: number}} [center] the nine-slice centre, relative to `bounds`
 * @property {{x: number, y: number}} [pivot] relative to `bounds`
 */

/**
 * @typedef {object} AsepriteSlice
 * @property {string} name
 * @property {string} [color]
 * @property {AsepriteSliceKey[]} keys
 */

/**
 * Aseprite's `--format json-hash` sheet export (`aseprite -b sprite.aseprite --sheet x.png --data
 * x.json --format json-hash --list-tags --list-layers --list-slices [--trim]`), as Aseprite 1.3
 * writes it. Frame keys use the default `--filename-format` "{title} {frame}.{extension}", in frame
 * order; `duration` is in milliseconds.
 *
 * @param {{title: string, frames: PackedFrame[], durations: number[], tags: AsepriteTag[], slices?: AsepriteSlice[],
 *   layers?: string[], image: string, width: number, height: number, frameNames?: string[]}} doc
 */
export function asepriteHash(doc) {
  const names = doc.frameNames ?? doc.frames.map((_, i) => `${doc.title} ${i}.aseprite`);
  return {
    frames: Object.fromEntries(doc.frames.map((f, i) => [names[i], {...frameEntry(f), duration: doc.durations[i]}])),
    meta: {
      app: 'https://www.aseprite.org/',
      version: '1.3.14-x64',
      image: doc.image,
      format: 'RGBA8888',
      size: {w: doc.width, h: doc.height},
      scale: '1',
      frameTags: doc.tags.map((t) => ({
        name: t.name,
        from: t.from,
        to: t.to,
        direction: t.direction,
        color: t.color ?? '#000000ff',
      })),
      layers: (doc.layers ?? ['Layer 1']).map((name) => ({name, opacity: 255, blendMode: 'normal'})),
      slices: (doc.slices ?? []).map((s) => ({name: s.name, color: s.color ?? '#0000ffff', keys: s.keys})),
    },
  };
}

/**
 * @typedef {object} BMChar
 * @property {number} id the code point
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} xoffset
 * @property {number} yoffset
 * @property {number} xadvance
 */

/**
 * @typedef {object} BMFontDoc
 * @property {string} face
 * @property {number} size
 * @property {number} lineHeight
 * @property {number} base
 * @property {number} scaleW
 * @property {number} scaleH
 * @property {string} page the file name of the page image
 * @property {[number, number, number, number]} padding up, right, down, left
 * @property {[number, number]} spacing
 * @property {BMChar[]} chars
 * @property {{first: number, second: number, amount: number}[]} kernings
 */

/**
 * AngelCode BMFont, text format (the `.fnt` of BMFont 1.14 with "Text" output).
 * @param {BMFontDoc} f
 */
export function bmfontText(f) {
  const lines = [
    `info face="${f.face}" size=${f.size} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=${f.padding.join(',')} spacing=${f.spacing.join(',')} outline=0`,
    `common lineHeight=${f.lineHeight} base=${f.base} scaleW=${f.scaleW} scaleH=${f.scaleH} pages=1 packed=0 alphaChnl=0 redChnl=0 greenChnl=0 blueChnl=0`,
    `page id=0 file="${f.page}"`,
    `chars count=${f.chars.length}`,
    ...f.chars.map(
      (c) =>
        `char id=${c.id} x=${c.x} y=${c.y} width=${c.width} height=${c.height} xoffset=${c.xoffset} yoffset=${c.yoffset} xadvance=${c.xadvance} page=0 chnl=15`,
    ),
    `kernings count=${f.kernings.length}`,
    ...f.kernings.map((k) => `kerning first=${k.first} second=${k.second} amount=${k.amount}`),
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * AngelCode BMFont as JSON, in the layout of `parse-bmfont-ascii` / `load-bmfont` and the
 * converters built on them (`msdf-bmfont-xml`, `three-bmfont-text`): the text format's blocks as
 * `info`, `common`, `pages`, `chars` and `kernings`.
 * @param {BMFontDoc} f
 */
export function bmfontJson(f) {
  return {
    pages: [f.page],
    chars: f.chars.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      xoffset: c.xoffset,
      yoffset: c.yoffset,
      xadvance: c.xadvance,
      page: 0,
      chnl: 15,
    })),
    info: {
      face: f.face,
      size: f.size,
      bold: 0,
      italic: 0,
      charset: '',
      unicode: 1,
      stretchH: 100,
      smooth: 0,
      aa: 1,
      padding: f.padding,
      spacing: f.spacing,
      outline: 0,
    },
    common: {
      lineHeight: f.lineHeight,
      base: f.base,
      scaleW: f.scaleW,
      scaleH: f.scaleH,
      pages: 1,
      packed: 0,
      alphaChnl: 0,
      redChnl: 0,
      greenChnl: 0,
      blueChnl: 0,
    },
    kernings: f.kernings,
  };
}
