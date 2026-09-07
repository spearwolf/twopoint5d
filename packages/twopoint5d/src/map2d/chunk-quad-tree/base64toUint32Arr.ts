export function base64toUint32Arr(base64: string, isLittleEndian = true): Uint32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  // a trailing byte group shorter than 4 has no uint32 to make and is left out
  const len = view.byteLength >> 2;
  const arr = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = view.getUint32(i << 2, isLittleEndian);
  }
  return arr;
}
