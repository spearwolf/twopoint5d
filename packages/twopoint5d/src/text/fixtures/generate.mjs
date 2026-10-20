// Writes pixel-8.xml — the font of pixel-8.fnt in BMFont's XML layout — from the text file beside it.
// The .fnt, the .json and the .png are copies of the lookbook's font (see README.md); run this after
// copying them again: `node packages/twopoint5d/src/text/fixtures/generate.mjs`.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const escapeXml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// a line of the text format: a tag and its key=value pairs, a value in quotes a string with spaces
const parseLine = (line) => {
  const [tag] = line.split(' ', 1);
  const pairs = [...line.matchAll(/(\w+)=("[^"]*"|\S*)/g)].map(([, key, value]) => [
    key,
    value.startsWith('"') ? value.slice(1, -1) : value,
  ]);
  return {tag, pairs};
};

const attributes = (pairs) => pairs.map(([key, value]) => `${key}="${escapeXml(value)}"`).join(' ');

const lines = readFileSync(join(here, 'pixel-8.fnt'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .map(parseLine);

const of = (tag) => lines.filter((line) => line.tag === tag);

const xml = [
  '<?xml version="1.0"?>',
  '<font>',
  ...of('info').map(({pairs}) => `  <info ${attributes(pairs)}/>`),
  ...of('common').map(({pairs}) => `  <common ${attributes(pairs)}/>`),
  '  <pages>',
  ...of('page').map(({pairs}) => `    <page ${attributes(pairs)} />`),
  '  </pages>',
  `  <chars count="${of('char').length}">`,
  ...of('char').map(({pairs}) => `    <char ${attributes(pairs)} />`),
  '  </chars>',
  `  <kernings count="${of('kerning').length}">`,
  ...of('kerning').map(({pairs}) => `    <kerning ${attributes(pairs)} />`),
  '  </kernings>',
  '</font>',
  '',
].join('\n');

writeFileSync(join(here, 'pixel-8.xml'), xml);
