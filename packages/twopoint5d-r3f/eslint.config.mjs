import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactPlugin from 'eslint-plugin-react';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import {jsRules, tsRules} from '../../eslint.shared.mjs';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/*'],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  {
    files: ['./*.{js,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      ...reactPlugin.configs.flat.recommended.languageOptions,
    },
    rules: {
      ...jsRules,
      ...tsRules,
      'no-console': 0,
      '@typescript-eslint/no-namespace': 0,
      'react/no-unknown-property': 0,
      'react/prop-types': 0,
    },
  },
];
