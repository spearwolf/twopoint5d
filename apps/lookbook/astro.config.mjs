import {defineConfig} from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  base: '/lookbook',
  server: {
    host: true,
    allowedHosts: true,
  },
  integrations: [react(), tailwind()],
});
