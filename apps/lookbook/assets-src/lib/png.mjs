// A PNG encoder for 8-bit RGBA, and a decoder that hands any image sharp reads back as RGBA.
//
// The encoder is ours, not sharp's: pixel art needs every byte it is given to reach the file
// unchanged — no premultiplied edges, no colour profile, no palette reduction — and an output that is
// the same on every run for the same pixels.
import zlib from 'node:zlib';
import sharp from 'sharp';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** @param {Uint8Array} bytes */
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * @param {string} type
 * @param {Uint8Array} data
 */
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} c
 */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Encodes RGBA pixels as a PNG. Each row takes the filter with the smallest sum of absolute
 * differences, the heuristic of libpng.
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba
 * @returns {Buffer}
 */
export function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  const candidate = new Uint8Array(stride);
  const best = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    const up = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : undefined;
    let bestSum = Infinity;
    let bestFilter = 0;
    for (let filter = 0; filter < 5; filter++) {
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? row[i - 4] : 0;
        const b = up ? up[i] : 0;
        const c = up && i >= 4 ? up[i - 4] : 0;
        let value = row[i];
        if (filter === 1) value -= a;
        else if (filter === 2) value -= b;
        else if (filter === 3) value -= (a + b) >> 1;
        else if (filter === 4) value -= paeth(a, b, c);
        value &= 0xff;
        candidate[i] = value;
        sum += value < 128 ? value : 256 - value;
      }
      if (sum < bestSum) {
        bestSum = sum;
        bestFilter = filter;
        best.set(candidate);
      }
    }
    raw[y * (stride + 1)] = bestFilter;
    raw.set(best, y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, {level: 9})),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * Decodes any image sharp reads (PNG, WebP, …) into 8-bit RGBA, without colour management.
 * @param {string} file
 * @returns {Promise<{width: number, height: number, data: Uint8Array}>}
 */
export async function decodeImage(file) {
  const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  return {width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length)};
}
