import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import {jsRules, tsRules} from '../../eslint.shared.mjs';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/*', 'public/*'],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['./*.{js,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...jsRules,
      ...tsRules,
    },
  },
];
