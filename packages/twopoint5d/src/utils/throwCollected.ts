/**
 * Throws what a teardown collected once it is done: nothing for no error, a single error
 * unchanged, several as an `AggregateError` with `message`.
 */
export function throwCollected(errors: readonly unknown[], message: string): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, message);
}
