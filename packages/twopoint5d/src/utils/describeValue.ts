/**
 * A value the way an error message quotes it: a string in double quotes, so `"16"` is told
 * apart from the number 16, everything else as `String()` writes it.
 */
export function describeValue(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}
