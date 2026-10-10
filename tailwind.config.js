/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // DECA Masters palette: dark blue, light blue, white
        navy: { DEFAULT: '#0A2342', 800: '#0F2F57', 700: '#14406F', 600: '#1B4F8A' },
        deca: { DEFAULT: '#0072CE', dark: '#005BA6', light: '#4FA8F0' },
        sky: { 50: '#F3F9FF', 100: '#E3F1FD', 200: '#C5E3FB', 300: '#9CCFF7' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(10,35,66,.06), 0 4px 16px rgba(10,35,66,.06)' },
    },
  },
  plugins: [],
}
