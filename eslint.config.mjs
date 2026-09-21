import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['.nx/*', '.vscode/*', '**/dist', '**/.astro', '**/*.d.ts', '**/node_modules'],
  },
  {
    files: ['**/*.{js,ts}'],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  eslintConfigPrettier,
  {
    files: ['**/*.{mjs,cjs}', 'scripts/*.{js,mjs,cjs}'],
    languageOptions: {globals: globals.node},
  },
  {
    files: ['**/*.{js,ts,astro}'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.{ts,astro}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-empty-function': 0,
      '@typescript-eslint/no-empty-interface': 0,
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-non-null-assertion': 0,
      '@typescript-eslint/no-unused-vars': ['error', {vars: 'all', args: 'after-used', argsIgnorePattern: '^_'}],
      '@typescript-eslint/no-unsafe-declaration-merging': 0,
      '@typescript-eslint/no-this-alias': 0,
      'no-restricted-syntax': [
        'error',
        {
          selector: ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/\\.ts$/]',
          message:
            'Relative imports carry the .js suffix (NodeNext) — a .ts suffix is written unchanged into the published .d.ts.',
        },
      ],
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
