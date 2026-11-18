/** Whether `value` is an array whose every entry is a string; an empty array is one. */
export const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');
