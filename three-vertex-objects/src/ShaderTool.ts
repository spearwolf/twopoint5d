const isNumber = (x: string | number): x is number => typeof x === 'number';

function add(a: string | number, b: string | number): string | number {
  if (isNumber(a) && isNumber(b)) {
    return a + b;
  } else if (isNumber(a)) {
    switch (a) {
      case 0:
        return b;
      default:
        return `${a} + ${b}`;
    }
  } else if (isNumber(b)) {
    switch (b) {
      case 0:
        return a;
      default:
        return `${a} + ${b}`;
    }
  } else {
    return `${a} + ${b}`;
  }
}

function sub(a: string | number, b: string | number): string | number {
  if (isNumber(a) && isNumber(b)) {
    return a - b;
  } else if (isNumber(a)) {
    switch (a) {
      case 0:
        return `-${b}`;
      default:
        return `${a} - ${b}`;
    }
  } else if (isNumber(b)) {
    switch (b) {
      case 0:
        return a;
      default:
        return `${a} - ${b}`;
    }
  } else {
    return `${a} - ${b}`;
  }
}

function mul(a: string | number, b: string | number): string | number {
  if (isNumber(b) && isNumber(a)) {
    return a * b;
  } else if (isNumber(a)) {
    switch (a) {
      case 0:
        return 0;
      case 1:
        return b;
      default:
        return `${a} * ${b}`;
    }
  } else if (isNumber(b)) {
    switch (b) {
      case 0:
        return 0;
      case 1:
        return a;
      default:
        return `${a} * ${b}`;
    }
  } else {
    return `${a} * ${b}`;
  }
}

function asFloat(number: string | number): string {
  const str = `${number}`.trim();
  if (str.match(/^[0-9]+$/)) {
    return `${str}.0`;
  }
  return str;
}

const ret = (res: string): string => `return ${res};`;

function mat4(
  m00: string | number = 0,
  m01: string | number = 0,
  m02: string | number = 0,
  m03: string | number = 0,
  m10: string | number = 0,
  m11: string | number = 0,
  m12: string | number = 0,
  m13: string | number = 0,
  m20: string | number = 0,
  m21: string | number = 0,
  m22: string | number = 0,
  m23: string | number = 0,
  m30: string | number = 0,
  m31: string | number = 0,
  m32: string | number = 0,
  m33: string | number = 1,
  as = asFloat,
): string {
  const toStr = as || ((x) => `${x}`);
  return `mat4(${toStr(m00)}, ${toStr(m01)}, ${toStr(m02)}, ${toStr(m03)}, ${toStr(m10)}, ${toStr(m11)}, ${toStr(m12)}, ${toStr(
    m13,
  )}, ${toStr(m20)}, ${toStr(m21)}, ${toStr(m22)}, ${toStr(m23)}, ${toStr(m30)}, ${toStr(m31)}, ${toStr(m32)}, ${toStr(m33)})`;
}

const rotate = (funcName = 'rotate', x = 0.0, y = 0.0, z = 1.0): string => `
mat4 ${funcName}(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  ${ret(
    mat4(
      add(mul('oc', x * x), 'c'),
      sub(mul('oc', x * y), mul(z, 's')),
      add(mul('oc', z * x), mul(y, 's')),
      0,
      add(mul('oc', x * y), mul(z, 's')),
      add(mul('oc', y * y), 'c'),
      sub(mul('oc', y * z), mul(x, 's')),
      0,
      sub(mul('oc', z * x), mul(y, 's')),
      add(mul('oc', y * z), mul(x, 's')),
      add(mul('oc', z * z), 'c'),
    ),
  )}
}`;

const rotateZ = (funcName = 'rotateZ'): string => rotate(funcName, 0, 0, 1);

export const ShaderTool = {
  add,
  asFloat,
  mat4,
  mul,
  ret,
  rotate,
  rotateZ,
  sub,
};
