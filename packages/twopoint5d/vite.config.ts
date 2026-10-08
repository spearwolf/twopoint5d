import {configDefaults, defineConfig} from 'vitest/config';

// The allocation specs measure heap bytes over tens of thousands of hot-path calls. Under V8
// coverage those calls run some five times slower, and on a shared CI runner a single test took
// anywhere from 3.5 to 6 seconds — the verdict hung on the runner's load, not on the bytes. They
// form a project of their own, which the coverage run leaves out and which gives each test the time
// a measurement needs; their bytes stay a gate of their own (`pnpm test:allocations`).
const allocationSpecs = 'src/**/hot-path-allocations*.spec.ts';

export default defineConfig({
  test: {
    // the allocation specs call gc() before every measurement (`src/testing/measureAllocatedBytes.ts`),
    // and without this flag the function does not exist
    execArgv: ['--expose-gc'],
    // Every `vi.spyOn` is taken back when its test ends. A spy that outlives the test that
    // installed it lies over every following test of the same file, and a test that measures
    // an order silently stops measuring anything.
    restoreMocks: true,
    // `vitest --run` runs both projects, `coverage` runs `specs` alone. A project that extends
    // this config appends its `include` to the one here, so the patterns live in the projects.
    projects: [
      {
        extends: true,
        test: {
          name: 'specs',
          // The suite lives in the sources: a spec is named `*.spec.ts` and sits next to
          // its module. The pattern is therefore pinned to `src/` instead of the default
          // glob — compiled output under `dist/` carries the same specs as `.js` and must
          // not be collected along with them.
          include: ['src/**/*.spec.ts'],
          exclude: [...configDefaults.exclude, allocationSpecs],
          // pinned to `src/` like the specs, for the same reason: `dist/` must not contribute a copy
          benchmark: {include: ['src/**/*.bench.ts']},
        },
      },
      {
        extends: true,
        // no benchmarks: they belong to `specs`, and the default pattern would run each of them twice
        test: {name: 'allocations', include: [allocationSpecs], testTimeout: 30_000, benchmark: {include: []}},
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // `include` counts every file under `src/`, one no spec loads included, so a bench or a
      // helper of the specs at 0 % would pull the thresholds down
      exclude: ['src/**/*.spec.ts', 'src/**/*.bench.ts', 'src/testing/**'],
      reporter: ['text-summary', 'lcov'],
      // The thresholds sit two points under the level measured when they were set — globally
      // and per module, the measured percentage rounded down minus two —, so a regression
      // turns the gate red while a line that moves does not — except `src/sprites/`, which is
      // held at 100 %: the sprite module was rebuilt with complete coverage as a requirement,
      // and a line without a test there is a regression, not noise. `src/controls/` and `src/display/`
      // carry no threshold of their own: the browser suite in `packages/twopoint5d-testing`
      // exercises them, and that suite is not measured.
      thresholds: {
        statements: 83,
        branches: 78,
        functions: 82,
        lines: 83,
        'src/map2d/**': {statements: 93, branches: 91, functions: 91, lines: 94},
        'src/sprites/**': {statements: 100, branches: 100, functions: 100, lines: 100},
        'src/stage/**': {statements: 94, branches: 88, functions: 95, lines: 95},
        'src/texture/**': {statements: 92, branches: 85, functions: 93, lines: 94},
        'src/utils/**': {statements: 88, branches: 89, functions: 83, lines: 87},
        'src/vertex-objects/**': {statements: 94, branches: 90, functions: 90, lines: 95},
      },
    },
  },
});
