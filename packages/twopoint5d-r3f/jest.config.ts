/* eslint-disable */
export default {
  displayName: 'twopoint5d-r3f',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.spec.json'}],
  },
  // transformIgnorePatterns: ['node_modules', 'twopoint5d/dist'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  setupFiles: ['./setup-tests.js'],
};
