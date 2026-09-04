// Every type that appears in a published signature must be one a consumer can write down.
// A type can be structurally sound and still be unusable from outside: `attw` and `publint`
// resolve such a type and stay quiet, so nothing else in the gate sees it.
//
// Walks the entry declaration file, follows every type reference transitively, and reports
// each declaration that is reachable from the published surface without being nameable.
//
//   node scripts/checkNameableTypes.mjs [entry.d.ts]   (default: dist/lib/index.d.ts, from the package root)

import path from 'node:path';
import ts from 'typescript';

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
const root = path.dirname(entry);

const program = ts.createProgram([entry], {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  skipLibCheck: true,
  strict: true,
});

const checker = program.getTypeChecker();
const entryFile = program.getSourceFile(entry);
if (entryFile == null) {
  console.error(`no such entry declaration file: ${entry}`);
  process.exit(2);
}

const deref = (sym) => (sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym);

const exported = checker.getExportsOfModule(checker.getSymbolAtLocation(entryFile));
const nameable = new Set(exported.map(deref));

const isLib = (fileName) => fileName.includes('node_modules') || /lib\.[\w.]*d\.ts$/.test(fileName);

const locate = (sym) => {
  const decl = sym.getDeclarations()?.[0];
  if (decl == null) return null;
  const file = decl.getSourceFile();
  return {
    file: path.relative(root, file.fileName),
    line: file.getLineAndCharacterOfPosition(decl.getStart()).line + 1,
  };
};

// `FrameLoop.OnFrame` is nameable as long as `FrameLoop` is: a qualified reference is only
// as reachable as the thing it starts from, so that leftmost name is what gets judged.
const rootOfReference = (node) => {
  let current = node;
  for (;;) {
    if (ts.isQualifiedName(current)) current = current.left;
    else if (ts.isPropertyAccessExpression(current)) current = current.expression;
    else return current;
  }
};

const referencedName = (node) => {
  if (ts.isTypeReferenceNode(node)) return node.typeName;
  if (ts.isTypeQueryNode(node)) return node.exprName;
  if (ts.isComputedPropertyName(node)) return node.expression;
  if (ts.isExpressionWithTypeArguments(node)) return node.expression;
  return null;
};

const found = new Map();
const scanned = new Set();
let frontier = exported.map((sym) => ({sym: deref(sym), owner: sym.getName()}));

while (frontier.length) {
  const next = [];
  for (const {sym, owner} of frontier) {
    if (scanned.has(sym)) continue;
    scanned.add(sym);
    for (const decl of sym.getDeclarations() ?? []) {
      if (isLib(decl.getSourceFile().fileName)) continue;
      const walk = (node) => {
        const nameNode = referencedName(node);
        if (nameNode != null) {
          const referenced = checker.getSymbolAtLocation(rootOfReference(nameNode));
          if (referenced != null) {
            const target = deref(referenced);
            const decls = target.getDeclarations() ?? [];
            if (
              decls.length > 0 &&
              !isLib(decls[0].getSourceFile().fileName) &&
              !(target.flags & ts.SymbolFlags.TypeParameter) &&
              !nameable.has(target)
            ) {
              const where = locate(target);
              if (where != null) {
                if (!found.has(target)) {
                  found.set(target, {name: target.getName(), ...where, uses: new Set()});
                  next.push({sym: target, owner: target.getName()});
                }
                found.get(target).uses.add(owner);
              }
            }
          }
        }
        node.forEachChild(walk);
      };
      walk(decl);
    }
  }
  frontier = next;
}

const rows = [...found.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const accepted = rows.filter((row) => ACCEPTED.has(`${row.file}:${row.name}`));
const offenders = rows.filter((row) => !ACCEPTED.has(`${row.file}:${row.name}`));

for (const row of offenders) {
  console.error(`${row.file}:${row.line}  ${row.name}  <- reached from ${[...row.uses].sort().join(', ')}`);
}

const summary = `${exported.length} exported symbols, ${accepted.length} accepted, ${offenders.length} not nameable`;

if (offenders.length > 0) {
  console.error(
    `\n${summary}\n` +
      'Export each name above from the public-api.ts of its module, or add it to ACCEPTED in this script with the reason.',
  );
  process.exit(1);
}

console.log(`${path.relative(process.cwd(), entry)}: ${summary}`);
