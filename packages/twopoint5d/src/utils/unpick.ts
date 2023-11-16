export const unpick = <T extends object>(o: T | null | undefined, ...keys: (keyof T)[]): Partial<T> | undefined =>
  o == null ? undefined : (Object.fromEntries(Object.entries(o).filter(([key]) => !keys.includes(key as keyof T))) as Partial<T>);
