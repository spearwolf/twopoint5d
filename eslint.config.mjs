import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['.nx/*', '.vscode/*', 'apps/*', 'packages/*', 'docs/*'],
  },
  {
    files: ['*.{js,mjs,cjs}', 'scripts/*.{js,mjs,cjs}'],
  },
  pluginJs.configs.recommended,
  eslintConfigPrettier,
  {languageOptions: {globals: globals.node}},
];
