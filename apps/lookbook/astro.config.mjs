import tailwindcss from '@tailwindcss/vite';
import {defineConfig} from 'astro/config';

process.env.ASTRO_TELEMETRY_DISABLED = '1';

// https://astro.build/config
export default defineConfig({
  base: '/lookbook',
  server: {
    host: true,
    allowedHosts: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
