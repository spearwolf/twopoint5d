import {describe, expect, it} from 'vitest';
import {
  type JsonCheck,
  JsonCheckError,
  jsonList,
  jsonNumber,
  jsonObject,
  jsonOneOf,
  jsonRecord,
  jsonString,
  jsonTuple,
} from './checkJson';

/** The refusal `check` throws for `value` at `path`; fails if it accepts the value. */
function refusal<T>(check: JsonCheck<T>, value: unknown, path = ''): JsonCheckError {
  try {
    check(value, path);
  } catch (error) {
    if (error instanceof JsonCheckError) return error;
    throw error;
  }
  throw new Error(`the check accepted ${JSON.stringify(value)}`);
}

describe('checkJson', () => {
  it('jsonNumber accepts a number and refuses anything else', () => {
    expect(jsonNumber(4, '')).toBe(4);
    expect(refusal(jsonNumber, '4').message).toBe('the root must be a number, got "4"');
  });

  it('jsonString accepts a string and refuses anything else', () => {
    expect(jsonString('a', '')).toBe('a');
    expect(refusal(jsonString, 4, 'name').message).toBe('name must be a string, got 4');
  });

  it('jsonOneOf accepts one of its strings and refuses another', () => {
    const check = jsonOneOf('a', 'b');
    expect(check('b', '')).toBe('b');
    expect(refusal(check, 'c', 'kind').message).toBe('kind must be one of "a", "b", got "c"');
  });

  it('jsonList accepts a list of accepted elements and names the element it refuses', () => {
    const list = [1, 2];
    expect(jsonList(jsonNumber)(list, '')).toBe(list);
    expect(refusal(jsonList(jsonNumber), 'x').message).toBe('the root must be a list, got "x"');
    expect(refusal(jsonList(jsonNumber), [1, 'two']).message).toBe('[1] must be a number, got "two"');
  });

  it('jsonTuple accepts a list of its length and refuses another', () => {
    const pair = [1, 'a'];
    expect(jsonTuple(jsonNumber, jsonString)(pair, '')).toBe(pair);
    expect(refusal(jsonTuple(jsonNumber, jsonString), [1, 'a', 2], 'at').message).toBe('at must be a list of 2, got [1,"a",2]');
    expect(refusal(jsonTuple(jsonNumber, jsonString), [1, 2], 'at').message).toBe('at[1] must be a string, got 2');
  });

  it('jsonRecord accepts an object of accepted values and names the key it refuses', () => {
    const record = {a: 1};
    expect(jsonRecord(jsonNumber)(record, '')).toBe(record);
    expect(refusal(jsonRecord(jsonNumber), [], 'marks').message).toBe('marks must be an object, got []');
    expect(refusal(jsonRecord(jsonRecord(jsonNumber)), {a: {b: 'x'}}).message).toBe('a.b must be a number, got "x"');
  });

  it('jsonObject accepts an object with its fields and names a field that is missing or nested', () => {
    const point = jsonObject<{x: number}>({x: jsonNumber});
    const value = {x: 1, more: true};
    expect(point(value, '')).toBe(value);
    expect(refusal(point, {}).message).toBe('x must be a number, got nothing');
    expect(refusal(point, null).message).toBe('the root must be an object, got null');
    const face = jsonObject<{eyes: {x: number}[]}>({eyes: jsonList(point)});
    expect(refusal(face, {eyes: [{x: 1}, {x: '4'}]}).message).toBe('eyes[1].x must be a number, got "4"');
  });

  it('cuts a value in a message after 40 characters', () => {
    const long = 'x'.repeat(60);
    // the JSON of the string is 62 characters: 39 of them, then the ellipsis
    expect(refusal(jsonNumber, long).message).toBe(`the root must be a number, got "${'x'.repeat(38)}…`);
  });

  it('refuses with a JsonCheckError that is a TypeError', () => {
    const error = refusal(jsonNumber, '4');
    expect(error).toBeInstanceOf(JsonCheckError);
    expect(error).toBeInstanceOf(TypeError);
    expect(error.name).toBe('JsonCheckError');
  });
});
