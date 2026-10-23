// Every type that appears in a published signature must be one a consumer can write
// down. A type can be structurally sound and still be unusable from outside: `attw` and
// `publint` resolve such a type and stay quiet, so nothing else in the gate sees it.
//
// Walks the entry declaration file, follows every type reference transitively, and
// reports each declaration that is reachable from the published surface without being
// nameable.
//
//   cd packages/twopoint5d && node ../../scripts/checkNameableTypes.mjs [entry.d.ts]
//   (default: dist/lib/index.d.ts)
//
// Exit 0: every reachable name is nameable or listed in ACCEPTED, and every entry of
// ACCEPTED matches a reachable name. 1: a name is not nameable, or an entry of ACCEPTED
// matches nothing. 2: the entry declaration file or the tsconfig is unreadable, or the
// declarations do not compile.

import path from 'node:path';
import {findUnnameableTypes, partitionAccepted} from './checkNameableTypes/findUnnameableTypes.mjs';
import {readCompilerOptions} from './shared/readCompilerOptions.mjs';

// A name that is reachable but not exported, and stays that way on purpose. Keyed by
// the entry, relative to the workspace root, because the exceptions belong to the surface
// of one entry; under it by file and name, because line numbers move. Every exception
// needs the reason next to it. A run against another entry has no exceptions, and so none
// that could go stale.
const ACCEPTED = new Map([
  [
    'packages/twopoint5d/dist/lib/index.d.ts',
    new Map([
      [
        'texture/TextureFactory.d.ts:TextureClasses',
        'a lookup table, not a type: `TextureOptionClasses` is the exported `keyof typeof` over it, ' +
          'and that union is everything a caller ever passes',
      ],
    ]),
  ],
]);

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const entry = path.resolve(process.argv[2] ?? 'dist/lib/index.d.ts');
const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
const acceptedForEntry = ACCEPTED.get(path.relative(workspaceRoot, entry).split(path.sep).join('/')) ?? new Map();

/** @type {ReturnType<typeof findUnnameableTypes>} */
let result;
try {
  // The options come as the root tsconfig has them; the module resolution and the `lib`
  // are what the code block check uses as a consumer too. `findUnnameableTypes` turns
  // `skipLibCheck` off for the declarations it reads, because it stops on diagnostics in
  // them.
  result = findUnnameableTypes({entry, compilerOptions: readCompilerOptions(tsconfigPath)});
} catch (err) {
  console.error(`checkNameableTypes: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}

const {accepted, offenders, stale} = partitionAccepted(result.rows, acceptedForEntry);

for (const row of offenders) {
  console.error(`${row.file}:${row.line}  ${row.name}  <- reached from ${row.uses.join(', ')}`);
}

for (const key of stale) {
  console.error(`${key}  <- listed in ACCEPTED, but no reachable name matches it`);
}

const summary = `${result.exported} exported symbols, ${accepted.length} accepted, ${offenders.length} not nameable, ${stale.length} stale in ACCEPTED`;

if (offenders.length > 0 || stale.length > 0) {
  console.error(
    `\n${summary}\n` +
      'Export each name above from the public-api.ts of its module, or add it to ACCEPTED in this script with the reason; delete each stale entry from ACCEPTED.',
  );
  process.exit(1);
}

console.log(`${path.relative(process.cwd(), entry)}: ${summary}`);
