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
// Exit 0: every reachable name is nameable or listed in ACCEPTED. 1: one is not.
// 2: the entry declaration file or the tsconfig is unreadable.

import path from 'node:path';
import {findUnnameableTypes, partitionAccepted} from './checkNameableTypes/findUnnameableTypes.mjs';
import {readCompilerOptions} from './shared/readCompilerOptions.mjs';

// A name that is reachable but not exported, and stays that way on purpose. Keyed by
// file and name, because line numbers move. Every entry needs the reason next to it.
const ACCEPTED = new Map([
  [
    'texture/TextureFactory.d.ts:TextureClasses',
    'a lookup table, not a type: `TextureOptionClasses` is the exported `keyof typeof` over it, ' +
      'and that union is everything a caller ever passes',
  ],
]);

const entry = path.resolve(process.argv[2] ?? 'dist/lib/index.d.ts');
const tsconfigPath = path.join(path.resolve(import.meta.dirname, '..'), 'tsconfig.json');

/** @type {ReturnType<typeof findUnnameableTypes>} */
let result;
try {
  // The options go in as the root tsconfig has them: the check reads the type checker,
  // not the diagnostics, and what counts for it, the module resolution and the `lib`,
  // should be what the code block check uses as a consumer too.
  result = findUnnameableTypes({entry, compilerOptions: readCompilerOptions(tsconfigPath)});
} catch (err) {
  console.error(`checkNameableTypes: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}

const {accepted, offenders} = partitionAccepted(result.rows, ACCEPTED);

for (const row of offenders) {
  console.error(`${row.file}:${row.line}  ${row.name}  <- reached from ${row.uses.join(', ')}`);
}

const summary = `${result.exported} exported symbols, ${accepted.length} accepted, ${offenders.length} not nameable`;

if (offenders.length > 0) {
  console.error(
    `\n${summary}\n` +
      'Export each name above from the public-api.ts of its module, or add it to ACCEPTED in this script with the reason.',
  );
  process.exit(1);
}

console.log(`${path.relative(process.cwd(), entry)}: ${summary}`);
