import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {webpSize} from './webpSize.mjs';

// a RIFF container whose first chunk starts at byte 12 and carries `payload` from byte 20;
// the sizes in the headers are not read, so they stay zero
const webp = (fourcc, payload) =>
  Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WEBP'),
    Buffer.from(fourcc),
    Buffer.alloc(4),
    payload,
    Buffer.alloc(16),
  ]);

const vp8x = (width, height) => {
  const payload = Buffer.alloc(10);
  payload.writeUIntLE(width - 1, 4, 3);
  payload.writeUIntLE(height - 1, 7, 3);
  return webp('VP8X', payload);
};

const vp8l = (width, height) => {
  const payload = Buffer.alloc(5);
  payload[0] = 0x2f;
  payload.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 1);
  return webp('VP8L', payload);
};

const vp8 = (width, height, scaleBits = 0) => {
  const payload = Buffer.alloc(10);
  payload.set([0x9d, 0x01, 0x2a], 3);
  payload.writeUInt16LE(width | (scaleBits << 14), 6);
  payload.writeUInt16LE(height | (scaleBits << 14), 8);
  return webp('VP8 ', payload);
};

describe('webpSize()', () => {
  it('reads the canvas size of an extended WebP (VP8X)', () => {
    assert.deepEqual(webpSize(vp8x(1000, 700)), {width: 1000, height: 700});
  });

  it('reads the size of a lossless WebP (VP8L)', () => {
    assert.deepEqual(webpSize(vp8l(1000, 700)), {width: 1000, height: 700});
  });

  it('reads the size of a lossy WebP (VP8), without its scale bits', () => {
    assert.deepEqual(webpSize(vp8(1000, 700, 3)), {width: 1000, height: 700});
  });

  it('refuses a file that is no WebP', () => {
    assert.throws(() => webpSize(Buffer.from('\x89PNG\r\n\x1a\n'.padEnd(40, '\0'))), /^Error: webpSize: /);
  });

  it('refuses a WebP whose first chunk it does not know', () => {
    assert.throws(() => webpSize(webp('ALPH', Buffer.alloc(10))), /^Error: webpSize: /);
  });

  it('refuses a lossy WebP without the start code of a key frame', () => {
    assert.throws(() => webpSize(webp('VP8 ', Buffer.alloc(10))), /^Error: webpSize: /);
  });
});
