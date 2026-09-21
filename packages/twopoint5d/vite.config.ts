import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // The suite lives in the sources: a spec is named `*.spec.ts` and sits next to
    // its module. The pattern is therefore pinned to `src/` instead of the default
    // glob — compiled output under `dist/` carries the same specs as `.js` and must
    // not be collected along with them.
    include: ['src/**/*.spec.ts'],
    // Every `vi.spyOn` is taken back when its test ends. A spy that outlives the test that
    // installed it lies over every following test of the same file, and a test that measures
    // an order silently stops measuring anything.
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      reporter: ['text-summary', 'lcov'],
      // The thresholds sit two points under the level measured when they were set — globally
      // and per module, the measured percentage rounded down minus two —, so a regression
      // turns the gate red while a line that moves does not. `src/controls/` and `src/display/`
      // carry no threshold of their own: the browser suite in `packages/twopoint5d-testing`
      // exercises them, and that suite is not measured.
      thresholds: {
        statements: 83,
        branches: 78,
        functions: 82,
        lines: 83,
        'src/map2d/**': {statements: 93, branches: 91, functions: 91, lines: 94},
        'src/sprites/**': {statements: 82, branches: 69, functions: 74, lines: 82},
        'src/stage/**': {statements: 94, branches: 88, functions: 95, lines: 95},
        'src/texture/**': {statements: 92, branches: 85, functions: 93, lines: 94},
        'src/utils/**': {statements: 88, branches: 89, functions: 83, lines: 87},
        'src/vertex-objects/**': {statements: 94, branches: 90, functions: 90, lines: 95},
      },
    },
  },
});
