/**
 * A stand-in for a function of an internals bridge — an `@internal` object whose functions a
 * class fills in from its `static` block —, in place until that class is evaluated. A call
 * before then, which a circular import can bring about, throws an error that names the
 * function instead of calling `undefined`.
 */
export function unfilledInternal(name: string): () => never {
  return () => {
    throw new Error(`expected ${name} to be defined: the class that fills it in has not been evaluated yet`);
  };
}
