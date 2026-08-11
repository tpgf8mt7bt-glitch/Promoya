/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1F3A',
          light: '#132C52',
          dark: '#071527',
        },
        gold: {
          DEFAULT: '#F5B400',
          light: '#FFC933',
          dark: '#D69A00',
        },
      },
      fontFamily: {
        display: ['Baloo 2', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        pill: '999px',
      },
    },
  },
  plugins: [],
};
