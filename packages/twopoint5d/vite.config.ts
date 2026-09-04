import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // The suite lives in the sources: a spec is named `*.spec.ts` and sits next to
    // its module. The pattern is therefore pinned to `src/` instead of the default
    // glob — compiled output under `dist/` carries the same specs as `.js` and must
    // not be collected along with them.
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      reporter: ['text-summary', 'lcov'],
      // The thresholds sit below the measured level, not on it: they are meant to
      // report a regression, not to fire on every line that moves. Raise them once
      // the gap has grown too wide.
      thresholds: {
        statements: 65,
        branches: 59,
        functions: 59,
        lines: 65,
        'src/vertex-objects/**': {statements: 92, branches: 84, functions: 90, lines: 92},
        'src/texture/**': {statements: 70, branches: 61, functions: 62, lines: 70},
      },
    },
  },
});
