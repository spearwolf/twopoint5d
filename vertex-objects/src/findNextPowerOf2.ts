export const findNextPowerOf2 = (x: number): number => {
  let p = 1;
  while (x > p) p <<= 1;
  return p;
};
