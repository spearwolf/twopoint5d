import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    // lookbook/public carries the vendored script that RainbowLine loads at runtime, see AGENTS.md
    ignores: ['.nx/*', '.vscode/*', '**/dist', '**/.astro', '**/lookbook/public', '**/*.d.ts', '**/node_modules'],
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
      // `any` stays allowed outside the published library code: the specs put their
      // renderer in with `as any`, and the lookbook demos are no API. The block at the
      // end of this list holds the library code to it.
      '@typescript-eslint/no-explicit-any': 0,
      // under `noUncheckedIndexedAccess` (root tsconfig.json) an index access carries
      // `undefined` in its type. `arr[i]!` in a loop bounded by `arr.length` is how the
      // hot paths say that the index is in range, without a branch per element.
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
  {
    // the shared fixtures of the browser tests run in the page of the test that imports them
    files: ['packages/twopoint5d-testing/test/helpers/*.js'],
    languageOptions: {globals: globals.browser},
  },
  {
    // the published library code: its types reach every consumer, so an `any` there needs
    // its reason on the spot; specs, benches and src/testing/ never ship
    files: ['packages/*/src/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.bench.ts', 'packages/*/src/testing/**'],
    rules: {'@typescript-eslint/no-explicit-any': 'error'},
  },
  {
    // a promise nobody awaits or catches loses its rejection, in a spec as much as in the
    // library; both rules need the type of the expression, which the project service
    // reads from the nearest tsconfig.json
    files: ['packages/*/src/**/*.ts'],
    languageOptions: {parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname}},
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
];
