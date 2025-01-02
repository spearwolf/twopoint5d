import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import {jsRules, tsRules} from '../../eslint.shared.mjs';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.{js,ts}'],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{js,ts}'],
    rules: {
      ...jsRules,
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      ...tsRules,
    },
  },
];
