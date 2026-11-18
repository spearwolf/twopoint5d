import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

// the aliases of tsconfig.json, which Astro resolves for the pages and Vitest does not read
const alias = (dir: string): string => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {'~components': alias('components'), '~demos': alias('demos'), '~layouts': alias('layouts')},
  },
  test: {
    // the specs of the logic helpers, next to their modules; the demo pages themselves are left to
    // the preview generator
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      // the modules a spec holds, named one by one: a glob over src/demos would count the shader code
      // of every scene, which no spec reaches, and pull the thresholds down with it
      include: [
        'src/demos/utils/atlasFrame.ts',
        'src/demos/utils/checkJson.ts',
        'src/demos/utils/demoParts.ts',
        'src/demos/utils/disposeMaterial.ts',
        'src/demos/utils/fetchAsset.ts',
        'src/demos/utils/seededRandom.ts',
        'src/demos/stage-masks/CrawlRig.ts',
        'src/demos/stage-masks/helpers.ts',
        'src/demos/stage-masks/SeanceClock.ts',
        'src/demos/stage-masks/TransitionCycler.ts',
      ],
      reporter: ['text-summary'],
      // two points under the level measured when they were set — the measured percentage rounded
      // down, minus two —, as in packages/twopoint5d/vite.config.ts: a regression turns the gate
      // red, a line that moves does not
      thresholds: {statements: 75, branches: 66, functions: 74, lines: 76},
    },
  },
});
