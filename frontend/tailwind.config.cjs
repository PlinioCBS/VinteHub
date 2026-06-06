/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        green: '#355641',
        copper: '#dd7752',
        brown: '#7A5137',
        charcoal: '#353535',
        'brand-gray': '#d9d9d6',
        cream: '#f5f4f2'
      },
      fontFamily: {
        serif: ['Libre Baskerville', 'serif'],
        sans: ['Lato', 'sans-serif']
      }
    }
  },
  plugins: []
};
