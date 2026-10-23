// the byte order of the host, which a Uint32Array laid over a buffer reads in
const HOST_IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export function base64toUint32Arr(base64: string, isLittleEndian = true): Uint32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // a trailing byte group shorter than 4 has no uint32 to make and is left out
  const len = bytes.byteLength >> 2;
  if (isLittleEndian === HOST_IS_LITTLE_ENDIAN) {
    // the bytes are in the order of the host already, so the array is laid over them without a
    // copy; a trailing byte group shorter than 4 stays in the buffer and out of the array
    return new Uint32Array(bytes.buffer, 0, len);
  }
  const view = new DataView(bytes.buffer);
  const arr = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = view.getUint32(i << 2, isLittleEndian);
  }
  return arr;
}
