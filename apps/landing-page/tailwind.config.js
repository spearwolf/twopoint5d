/** @type {import('tailwindcss').Config} */
export default {
  plugins: [require('@tailwindcss/aspect-ratio')],
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
};
