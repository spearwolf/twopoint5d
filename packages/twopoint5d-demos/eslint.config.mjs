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
  {languageOptions: {globals: globals.browser}},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      ...jsRules,
      ...tsRules,
    },
  },
];
