// The width and height of a WebP image, read from its header: the generator of the lookbook
// previews checks each screenshot with it, and a spec checks the images in the app.
// https://developers.google.com/speed/webp/docs/riff_container

/**
 * @param {Uint8Array} bytes the file, or at least its first 30 bytes
 * @returns {{width: number, height: number}}
 */
export function webpSize(bytes) {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buf.length < 30 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') {
    throw new Error('webpSize: not a WebP file');
  }
  const chunk = buf.toString('latin1', 12, 16);
  switch (chunk) {
    // the extended format: the canvas size, 24 bits each, minus one
    case 'VP8X':
      return {width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1};
    // lossless: a signature byte, then 14 bits each, minus one
    case 'VP8L': {
      if (buf[20] !== 0x2f) throw new Error('webpSize: a VP8L chunk without its signature');
      const bits = buf.readUInt32LE(21);
      return {width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1};
    }
    // lossy: the frame tag, the start code of a key frame, then 14 bits each and two scale bits
    case 'VP8 ': {
      if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) {
        throw new Error('webpSize: a VP8 chunk without the start code of a key frame');
      }
      return {width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff};
    }
    default:
      throw new Error(`webpSize: unknown first chunk ${JSON.stringify(chunk)}`);
  }
}
