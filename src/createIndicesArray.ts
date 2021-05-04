export function createIndicesArray(
  indices: number[],
  count: number,
): Uint32Array {
  const itemCount = indices.length;
  const arr = new Uint32Array(count * itemCount);
  const stride = Math.max(...indices) + 1;

  for (let i = 0; i < count; i++) {
    for (let j = 0; j < itemCount; j++) {
      arr[i * itemCount + j] = indices[j] + i * stride;
    }
  }

  return arr;
}
