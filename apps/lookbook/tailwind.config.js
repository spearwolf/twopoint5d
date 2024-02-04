/** @type {import('tailwindcss').Config} */
export default {
  plugins: [require('@tailwindcss/aspect-ratio')],
  content: ['./src/**/*.{astro,html,js,ts}'],
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
