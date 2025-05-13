import aspectRatio from '@tailwindcss/aspect-ratio';

/** @type {import('tailwindcss').Config} */
export default {
  plugins: [aspectRatio],
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      gridTemplateColumns: {
        ['sidebar-content']: '25rem auto',
        ['only-content']: 'auto',
        ['demo-cards']: 'repeat(auto-fill, minmax(30ch, 1fr))',
      },
    },
  },
};
