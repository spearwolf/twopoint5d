// Type-checks Markdown code snippets against the library as a consumer sees it.
//
// Each snippet becomes a virtual TypeScript module in `<anchorDir>/__doc_snippets__/`; nothing
// is written to disk. Because the virtual folder sits in `anchorDir`, a bare import such as
// `@spearwolf/twopoint5d` or `three/webgpu` resolves the way it does for a package there.
// Diagnostics are mapped back to the line and column in the Markdown file.

import path from 'node:path';
import ts from 'typescript';

const VIRTUAL_DIR = '__doc_snippets__';

/**
 * @param {{
 *   snippets: Array<{file: string, line: number, indent: number, code: string}>,
 *   anchorDir: string,
 *   tsconfigPath: string,
 * }} params
 * @returns {Array<{file?: string, line?: number, column?: number, code: number, message: string}>}
 *   a diagnostic without a location (a global one from the compiler) has no `file`, `line` and `column`
 */
export function compileSnippets({snippets, anchorDir, tsconfigPath}) {
  if (snippets.length === 0) return [];

  const options = readCompilerOptions(tsconfigPath);

  const virtualFiles = new Map(snippets.map((snippet, index) => [path.join(anchorDir, VIRTUAL_DIR, `${index}.ts`), snippet]));

  const host = ts.createCompilerHost(options);
  const {fileExists, readFile, getSourceFile} = host;
  host.fileExists = (fileName) => virtualFiles.has(fileName) || fileExists.call(host, fileName);
  host.readFile = (fileName) => virtualFiles.get(fileName)?.code ?? readFile.call(host, fileName);
  host.getSourceFile = (fileName, languageVersionOrOptions, ...rest) => {
    const snippet = virtualFiles.get(fileName);
    return snippet == null
      ? getSourceFile.call(host, fileName, languageVersionOrOptions, ...rest)
      : ts.createSourceFile(fileName, snippet.code, languageVersionOrOptions);
  };

  const program = ts.createProgram({rootNames: [...virtualFiles.keys()], options, host});

  const diagnostics = [];
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

    if (diagnostic.file == null) {
      diagnostics.push({code: diagnostic.code, message});
      continue;
    }

    const snippet = virtualFiles.get(diagnostic.file.fileName);
    if (snippet == null) continue;

    const {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    diagnostics.push({
      file: snippet.file,
      line: snippet.line + line,
      column: character + 1 + snippet.indent,
      code: diagnostic.code,
      message,
    });
  }
  return diagnostics;
}

// `parseJsonConfigFileContent` would scan the whole repository for files (the root config has no
// `include`), and the snippets are the only files that matter here.
function readCompilerOptions(tsconfigPath) {
  const {config, error} = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (error != null) throw new Error(`cannot read ${tsconfigPath}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);

  const {options, errors} = ts.convertCompilerOptionsFromJson(config.compilerOptions, path.dirname(tsconfigPath));
  if (errors.length > 0) {
    throw new Error(
      `invalid compiler options in ${tsconfigPath}: ${errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('; ')}`,
    );
  }

  return {
    ...options,
    noEmit: true,
    // an example declares what it shows without having to use it
    noUnusedLocals: false,
    noUnusedParameters: false,
    // nothing is emitted, so `tslib` is not needed
    importHelpers: false,
    // a snippet sees the DOM and what it imports, not the globals of Node, Mocha or Sinon
    types: [],
    // every snippet is a module of its own, so two of them may both declare `const display`
    moduleDetection: ts.ModuleDetectionKind.Force,
  };
}
