/**
 * Reads one option, in the type the options declare for it. An option that is missing,
 * `undefined` or `null` answers the default.
 */
export const readOption = <O extends object, K extends keyof O>(
  options: O | null | undefined,
  propName: K,
  defValue: NonNullable<O[K]>,
): NonNullable<O[K]> => {
  if (options != null && propName in options) {
    const val = options[propName];
    if (val != null) return val;
  }
  return defValue;
};
