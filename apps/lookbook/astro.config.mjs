import {defineConfig} from 'astro/config';

// eslint-disable-next-line import/no-unresolved
import react from '@astrojs/react';

// eslint-disable-next-line import/no-unresolved
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  base: '/lookbook',
  integrations: [react(), tailwind()],
});
