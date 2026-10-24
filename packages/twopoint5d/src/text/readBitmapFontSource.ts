import type {BitmapFontData} from './BitmapFont.js';
import {isScalarValue} from './codePoints.js';

// The readers of the two string spellings of BMFont, text and XML, into the JSON layout. Neither
// checks the values: `BitmapFont` does that for all three spellings alike.

const WHERE = 'BitmapFont';

// in XML every value is a string; these stay strings, every other one is read as a number or a list
const STRING_KEYS: ReadonlySet<string> = new Set(['face', 'charset', 'file']);

const NUMBER = /^-?\d+(?:\.\d+)?$/;
const LIST = /^-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)+$/;

// a value as BMFont writes it: a number, a list of numbers `1,2,3,4`, or else the string as it is
const readValue = (key: string, raw: string, quoted: boolean): unknown => {
  if (quoted && STRING_KEYS.has(key)) return raw;
  if (NUMBER.test(raw)) return Number(raw);
  if (LIST.test(raw)) return raw.split(',').map(Number);
  return raw;
};

type Entry = Record<string, unknown>;

// defined, not assigned: an attribute "__proto__" would run into the __proto__ setter of
// Object.prototype and set the prototype of the entry — JSON.parse() makes such a key a field,
// and so do the readers of the other two spellings
const setField = (entry: Entry, key: string, value: unknown): void => {
  Object.defineProperty(entry, key, {value, writable: true, enumerable: true, configurable: true});
};

interface Block {
  readonly tag: string;
  readonly entry: Entry;
}

// the blocks of the font into the JSON layout; any other tag is left out
const assemble = (blocks: readonly Block[]): BitmapFontData => {
  const data = {pages: [] as string[], chars: [] as unknown[], kernings: [] as unknown[]} as Entry & {
    pages: string[];
    chars: unknown[];
    kernings: unknown[];
  };
  for (const {tag, entry} of blocks) {
    switch (tag) {
      case 'info':
      case 'common':
        data[tag] = entry;
        break;
      case 'page':
        data.pages[typeof entry['id'] === 'number' ? entry['id'] : data.pages.length] = String(entry['file'] ?? '');
        break;
      case 'char':
        data.chars.push(entry);
        break;
      case 'kerning':
        data.kernings.push(entry);
        break;
    }
  }
  return data as unknown as BitmapFontData;
};

// `tag key=value key="a string" …`, one block per line
const readText = (source: string): BitmapFontData => {
  const blocks: Block[] = [];
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const tag = trimmed.split(/\s/, 1)[0]!;
    const entry: Entry = {};
    for (const [, key, quoted, plain] of trimmed.matchAll(/(\w+)=(?:"([^"]*)"|(\S*))/g)) {
      setField(entry, key!, quoted !== undefined ? readValue(key!, quoted, true) : readValue(key!, plain!, false));
    }
    blocks.push({tag, entry});
  }
  return assemble(blocks);
};

const ENTITIES: ReadonlyMap<string, string> = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
]);

// A numeric entity that is no char — beyond U+10FFFF, a surrogate, or too large for a number —
// and a named entity outside the five of XML — `&constructor;` as well — stay as they are
// written. An entity stands only in a text attribute (`face`, `charset`, `file`); in a number
// field `BitmapFont` refuses the string anyway, naming the field
const decodeEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, name: string) => {
    if (name.startsWith('#')) {
      const code = name.startsWith('#x') ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return isScalarValue(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES.get(name) ?? match;
  });

// the elements of BMFont's XML and their attributes, by a tokenizer: no DOMParser, so it runs in Node
// and in a worker. The layout is flat, and every value the font needs sits in an attribute
const readXml = (source: string): BitmapFontData => {
  const blocks: Block[] = [];
  const text = source.replace(/<!--[\s\S]*?-->/g, '');
  for (const [, tag, attributes] of text.matchAll(/<\s*(\w+)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g)) {
    const entry: Entry = {};
    for (const [, key, double, single] of attributes!.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      // one of the two quotes matched
      setField(entry, key!, readValue(key!, decodeEntities((double ?? single)!), true));
    }
    blocks.push({tag: tag!, entry});
  }
  return assemble(blocks);
};

/**
 * The font of a BMFont source in the JSON layout: an object is taken as it is, a string is read as JSON
 * (`{…`), XML (`<…`) or the text format (lines `info …`, `common …`).
 *
 * @throws {Error} for the binary format, JSON that does not parse, and a string that is none of the three.
 */
export function readBitmapFontSource(source: string | BitmapFontData): BitmapFontData {
  if (typeof source !== 'string') return source;

  const start = source.trimStart();
  if (start.startsWith('BMF')) {
    throw new Error(`${WHERE}: this is a binary BMFont file, which is not read — export the font as text, XML or JSON`);
  }
  if (start.startsWith('{')) {
    try {
      return JSON.parse(start) as BitmapFontData;
    } catch (error) {
      throw new Error(`${WHERE}: the JSON of the font does not parse — ${(error as Error).message}`, {cause: error});
    }
  }
  if (start.startsWith('<')) return readXml(start);

  const firstTag = start.split(/\s/, 1)[0];
  if (firstTag === 'info' || firstTag === 'common' || /^common\s/m.test(start)) return readText(start);

  throw new Error(
    `${WHERE}: the source is neither BMFont text (lines "info …", "common …"), XML (<font>) nor JSON ({"pages", "chars", "common"})`,
  );
}
