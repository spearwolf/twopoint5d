import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, test} from 'node:test';
import {readCompilerOptions} from '../shared/readCompilerOptions.mjs';
import {findUnnameableTypes, partitionAccepted} from './findUnnameableTypes.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const compilerOptions = readCompilerOptions(path.join(repoRoot, 'tsconfig.json'));
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'checkNameableTypes-')));

after(() => fs.rmSync(tmp, {recursive: true, force: true}));

let count = 0;

/**
 * Writes the declaration files into a directory of their own and finds the unnameable
 * types reachable from `index.d.ts`.
 *
 * @param {Record<string, string>} files
 */
const find = (files) => {
  const dir = path.join(tmp, String(count++));
  fs.mkdirSync(dir);
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return findUnnameableTypes({entry: path.join(dir, 'index.d.ts'), compilerOptions});
};

test('a type the entry exports is nameable', () => {
  const {exported, rows} = find({'index.d.ts': 'export interface A { x: number }\nexport declare function f(): A;\n'});

  assert.equal(exported, 2);
  assert.deepEqual(rows, []);
});

test('a declaration the entry does not export is reported with its file, line and the export that reaches it', () => {
  const {rows} = find({
    'a.d.ts': 'export interface Hidden { x: number }\nexport declare function f(): Hidden;\n',
    'index.d.ts': "export { f } from './a.js';\n",
  });

  assert.deepEqual(rows, [{name: 'Hidden', file: 'a.d.ts', line: 1, uses: ['f']}]);
});

test('a type reached only through another unnameable one is reported with the name that reaches it', () => {
  const {rows} = find({
    'a.d.ts': [
      'export interface Deeper { y: number }',
      'export interface Hidden { inner: Deeper }',
      'export declare function f(): Hidden;',
      '',
    ].join('\n'),
    'index.d.ts': "export { f } from './a.js';\n",
  });

  assert.deepEqual(rows, [
    {name: 'Deeper', file: 'a.d.ts', line: 1, uses: ['Hidden']},
    {name: 'Hidden', file: 'a.d.ts', line: 2, uses: ['f']},
  ]);
});

test('a qualified name is judged by its leftmost name', () => {
  const nameable = find({
    'index.d.ts': 'export declare namespace NS { interface Inner {} }\nexport declare function g(): NS.Inner;\n',
  });
  assert.deepEqual(nameable.rows, []);

  const unnameable = find({
    'a.d.ts': 'export declare namespace Priv { interface Inner {} }\n',
    'index.d.ts': "import type {Priv} from './a.js';\nexport declare function g(): Priv.Inner;\n",
  });
  assert.deepEqual(
    unnameable.rows.map(({name, file}) => ({name, file})),
    [{name: 'Priv', file: 'a.d.ts'}],
  );
});

test('an import type is judged by the name it imports', () => {
  const {rows} = find({
    'internal.d.ts': 'export interface Hidden { x: number }\n',
    'index.d.ts': "export declare const a: import('./internal.js').Hidden;\n",
  });
  assert.deepEqual(rows, [{name: 'Hidden', file: 'internal.d.ts', line: 1, uses: ['a']}]);

  const qualified = find({
    'internal.d.ts': 'export declare namespace NS { interface Inner {} }\n',
    'index.d.ts': "export declare const a: import('./internal.js').NS.Inner;\n",
  });
  assert.deepEqual(
    qualified.rows.map(({name}) => name),
    ['NS'],
  );

  const reexported = find({
    'internal.d.ts': 'export interface Pub { x: number }\n',
    'index.d.ts': "export type {Pub} from './internal.js';\nexport declare const a: import('./internal.js').Pub;\n",
  });
  assert.deepEqual(reexported.rows, []);

  const moduleQuery = find({
    'internal.d.ts': 'export interface Hidden { x: number }\n',
    'index.d.ts': "export declare const m: typeof import('./internal.js');\n",
  });
  assert.deepEqual(moduleQuery.rows, []);
});

test('type parameters and the types of the TypeScript lib are never reported', () => {
  const {rows} = find({'index.d.ts': 'export declare function k<T>(x: T): Promise<Map<string, T>>;\n'});

  assert.deepEqual(rows, []);
});

test('an entry that does not exist throws', () => {
  assert.throws(
    () => findUnnameableTypes({entry: path.join(tmp, 'no-such-dir', 'index.d.ts'), compilerOptions}),
    /no such entry declaration file/,
  );
});

test('a row whose file and name the accepted map lists is accepted, every other one is an offender', () => {
  const listed = {name: 'Table', file: 'a.d.ts', line: 1, uses: ['f']};
  const other = {name: 'Table', file: 'b.d.ts', line: 1, uses: ['f']};
  const unlisted = {name: 'Other', file: 'a.d.ts', line: 2, uses: ['f']};

  const {accepted, offenders} = partitionAccepted([listed, other, unlisted], new Map([['a.d.ts:Table', 'a lookup table']]));

  assert.deepEqual(accepted, [listed]);
  assert.deepEqual(offenders, [other, unlisted]);
});
