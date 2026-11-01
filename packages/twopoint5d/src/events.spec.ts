import {describe, expect, test} from 'vitest';
import * as events from './events.js';

// the end of every stage of the library goes out under one name
const SHARED_DISPOSE = ['OnCanvas2DStageDispose', 'OnStageDispose'];

const constants = Object.entries(events as Record<string, unknown>).filter(
  (entry): entry is [string, string] => entry[0].startsWith('On') && typeof entry[1] === 'string',
);

describe('event names', () => {
  test('each is the name of its constant without On, which names the emitter', () => {
    for (const [name, value] of constants) {
      if (SHARED_DISPOSE.includes(name)) continue;
      expect(value, name).toBe(name[2]!.toLowerCase() + name.slice(3));
    }
  });

  test('two constants share a name only where the stages announce their end', () => {
    const byValue = new Map<string, string[]>();
    for (const [name, value] of constants) byValue.set(value, [...(byValue.get(value) ?? []), name]);
    for (const [value, names] of byValue) {
      if (value === 'dispose') expect([...names].sort(), value).toEqual(SHARED_DISPOSE);
      else expect(names, value).toHaveLength(1);
    }
  });
});
