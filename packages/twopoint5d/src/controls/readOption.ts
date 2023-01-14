export const readOption = <OptionsType extends Object, ValueType>(
  options: OptionsType,
  propName: keyof OptionsType,
  defValue: ValueType,
): ValueType => {
  if (options != null && propName in options) {
    const val = options[propName];
    if (val !== undefined) return val as unknown as ValueType;
  }
  return defValue;
};
