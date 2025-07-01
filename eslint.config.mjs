import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['.nx/*', '.vscode/*', 'docs/*', '**/dist', '**/.astro', '**/lookbook/public', '**/*.d.ts'],
  },
  {
    files: ['**/*.{js,ts}'],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{mjs,cjs}', 'scripts/*.{js,mjs,cjs}'],
    languageOptions: {globals: globals.node},
  },
  {
    files: ['**/*.{js,ts}'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 0,
      '@typescript-eslint/ban-ts-ignore': 0,
      '@typescript-eslint/ban-types': 0,
      '@typescript-eslint/no-empty-function': 0,
      '@typescript-eslint/no-empty-interface': 0,
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-non-null-assertion': 0,
      '@typescript-eslint/no-unused-vars': ['error', {vars: 'all', args: 'after-used', argsIgnorePattern: '^_'}],
      '@typescript-eslint/no-unsafe-declaration-merging': 0,
      '@typescript-eslint/no-this-alias': 0,
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.mocha,
        ...globals.chai,
      },
    },
    rules: {
      'no-console': 0,
      'no-unused-expressions': 0,
      '@typescript-eslint/no-unused-expressions': 0,
    },
  },
];
