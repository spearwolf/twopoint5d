// The checks of a code point the text module shares; internal, not re-exported by public-api.ts.

/** The last code point of Unicode. */
export const MAX_CODE_POINT = 0x10ffff;

/** Whether `value` is a code point: a whole number from 0 to 0x10FFFF. */
export const isCodePoint = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_CODE_POINT;

/** Whether `code` is a Unicode scalar value: a code point that is no surrogate, so XML may refer to it. */
export const isScalarValue = (code: number): boolean => isCodePoint(code) && !(code >= 0xd800 && code <= 0xdfff);
