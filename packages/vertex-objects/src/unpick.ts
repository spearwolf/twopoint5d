export const unpick = <T extends Object>(o: T, ...keys: (keyof T)[]): Partial<T> =>
  o ? (Object.fromEntries(Object.entries(o).filter(([key]) => !keys.includes(key as keyof T))) as Partial<T>) : undefined;
