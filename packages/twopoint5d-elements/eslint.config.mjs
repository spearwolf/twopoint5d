import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import {tsRules} from '../../eslint.shared.mjs';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['build/*', 'dist/*', 'tests/*'],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['src/**/*.{js,ts}'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...tsRules,
    },
  },
  {
    files: ['*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
];
