/** @type {import('eslint').Linter.RulesRecord} */
const jsRules = {
  'no-console': 'error',
};

/** @type {import('eslint').Linter.RulesRecord} */
const tsRules = {
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
};

export {jsRules, tsRules};
