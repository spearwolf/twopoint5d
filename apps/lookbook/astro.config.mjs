import {defineConfig} from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

process.env.ASTRO_TELEMETRY_DISABLED = '1';

// https://astro.build/config
export default defineConfig({
  base: '/lookbook',
  server: {
    host: true,
    allowedHosts: true,
  },
  integrations: [react(), tailwind()],
});
