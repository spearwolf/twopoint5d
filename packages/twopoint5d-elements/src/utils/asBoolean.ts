export function asBoolean(val: any): boolean {
  if (val == null) return false;
  switch (typeof val) {
    case 'boolean':
      return val;
    case 'string': {
      switch (val.trim().toLowerCase()) {
        case 'true':
        case 'yes':
        case 'on':
        case '1':
          return true;
        default:
          return false;
      }
    }
    default:
      return Boolean(val);
  }
}
