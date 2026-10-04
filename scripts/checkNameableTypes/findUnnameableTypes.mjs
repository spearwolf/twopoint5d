import path from 'node:path';
import ts from '@typescript/typescript6';

const isLib = (fileName) => fileName.includes('node_modules') || /lib\.[\w.]*d\.ts$/.test(fileName);

// `FrameLoop.OnFrame` is nameable as long as `FrameLoop` is: a qualified reference is
// only as reachable as the thing it starts from, so that leftmost name is what gets
// judged.
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
  // tsc writes `import("./x.js").T` into a declaration when it takes over a type from a
  // module the file does not import. The qualifier names the declaration, and
  // `rootOfReference` judges its leftmost name; a `typeof import("./x.js")` has no
  // qualifier and names a module, not a declaration.
  if (ts.isImportTypeNode(node)) return node.qualifier ?? null;
  return null;
};

/**
 * Walks the entry declaration file, follows every type reference transitively, and
 * collects each declaration that is reachable from the exported surface without being
 * exported itself.
 *
 * @param {{entry: string, compilerOptions: import('@typescript/typescript6').CompilerOptions}} params
 * @returns {{
 *   exported: number,
 *   rows: Array<{name: string, file: string, line: number, uses: string[]}>,
 * }}
 */
export function findUnnameableTypes({entry, compilerOptions}) {
  const root = path.dirname(entry);
  const program = ts.createProgram([entry], compilerOptions);
  const checker = program.getTypeChecker();
  const entryFile = program.getSourceFile(entry);
  if (entryFile == null) throw new Error(`no such entry declaration file: ${entry}`);

  const deref = (sym) => (sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym);

  const exported = checker.getExportsOfModule(/** @type {ts.Symbol} */ (checker.getSymbolAtLocation(entryFile)));
  const nameable = new Set(exported.map(deref));

  const locate = (sym) => {
    const decl = sym.getDeclarations()?.[0];
    if (decl == null) return null;
    const file = decl.getSourceFile();
    return {
      file: path.relative(root, file.fileName),
      line: file.getLineAndCharacterOfPosition(decl.getStart()).line + 1,
    };
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

  const rows = [...found.values()]
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
    .map((row) => ({...row, uses: [...row.uses].sort()}));

  return {exported: exported.length, rows};
}

/**
 * @template {{name: string, file: string}} Row
 * @param {Row[]} rows
 * @param {ReadonlyMap<string, string>} accepted file and name to the reason it stays
 * @returns {{accepted: Row[], offenders: Row[]}}
 */
export function partitionAccepted(rows, accepted) {
  const isAccepted = (row) => accepted.has(`${row.file}:${row.name}`);
  return {
    accepted: rows.filter(isAccepted),
    offenders: rows.filter((row) => !isAccepted(row)),
  };
}
