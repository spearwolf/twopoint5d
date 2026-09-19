export const unpick = <T extends object>(o: T | null | undefined, ...keys: (keyof T)[]): Partial<T> | undefined => {
  if (o == null) return undefined;

  const result: Partial<T> = {};
  // Reflect.ownKeys() lists the symbol keys beside the string keys; of those, the enumerable
  // ones are taken — the same ones a spread copies
  for (const key of Reflect.ownKeys(o) as (keyof T)[]) {
    if (!keys.includes(key) && Object.prototype.propertyIsEnumerable.call(o, key)) {
      result[key] = o[key];
    }
  }
  return result;
};
