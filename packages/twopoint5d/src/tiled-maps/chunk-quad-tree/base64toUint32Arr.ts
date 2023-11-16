export function base64toUint32Arr(base64: string, isLittleEndian = true): Uint32Array {
  const {buffer} = Uint8Array.from(atob(base64) as any, (char: any) => char.charCodeAt(0));
  const view = new DataView(buffer);
  const len = view.byteLength >> 2;
  const arr = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = view.getUint32(i << 2, isLittleEndian);
  }
  return arr;
}
