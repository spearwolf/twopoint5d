export const readOption = <OptionsType extends object, ValueType>(
  options: OptionsType | null | undefined,
  propName: keyof OptionsType,
  defValue: ValueType,
): ValueType => {
  if (options != null && propName in options) {
    const val = options[propName];
    if (val !== undefined) return val as unknown as ValueType;
  }
  return defValue;
};
