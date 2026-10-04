import path from 'node:path';
import ts from '@typescript/typescript6';

/**
 * `parseJsonConfigFileContent` would scan the whole repository for files (the root
 * config has no `include`), and the checks that read a tsconfig here need only its
 * compiler options. So only the `compilerOptions` of the file itself are read;
 * `extends` is not followed, and the root config inherits from nothing.
 *
 * @param {string} tsconfigPath
 * @returns {import('@typescript/typescript6').CompilerOptions}
 */
export function readCompilerOptions(tsconfigPath) {
  const {config, error} = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (error != null) throw new Error(`cannot read ${tsconfigPath}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);

  const {options, errors} = ts.convertCompilerOptionsFromJson(config.compilerOptions, path.dirname(tsconfigPath));
  if (errors.length > 0) {
    throw new Error(
      `invalid compiler options in ${tsconfigPath}: ${errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('; ')}`,
    );
  }

  return options;
}
