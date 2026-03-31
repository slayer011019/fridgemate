/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ed',
          100: '#dde9db',
          500: '#7ea382',
          600: '#698d6d',
          700: '#557259'
        },
        accent: '#f59e0b'
      }
    }
  },
  plugins: []
};
