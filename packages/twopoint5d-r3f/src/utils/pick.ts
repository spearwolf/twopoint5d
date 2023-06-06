export const pick = <T extends Object>(o: T, ...keys: (keyof T)[]): Partial<T> | undefined =>
  o ? (Object.fromEntries(Object.entries(o).filter(([key]) => keys.includes(key as keyof T))) as Partial<T>) : undefined;
