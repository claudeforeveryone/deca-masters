/** @type {import('tailwindcss').Config} */
// Design tokens taken from deca.org (webflow CSS variables + career cluster colours).
// Shape rule: no rounded corners anywhere, so every radius token is 0.
const square = Object.fromEntries(['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', '3xl', 'full'].map((k) => [k, '0px']))

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: square,
    extend: {
      colors: {
        // Text: headings, body, secondary. Used consistently everywhere.
        ink: { DEFAULT: '#141414', 2: '#333333', 3: '#666666' },
        line: { DEFAULT: '#E4E4E4', strong: '#B1B1B1' },
        canvas: '#F2F4F7', // DECA grey-001 panels
        brand: { DEFAULT: '#0072CE', hover: '#055CA8', press: '#174783' }, // blue-04 / 05 / 06
        tint: { DEFAULT: '#EFF6FC', 2: '#A1CEEF', 3: '#70B0E0' }, // blue-001 / 01 / 02
        navy: { DEFAULT: '#002D6B', deep: '#071634', midnight: '#1C283F', footer: '#1F2A32' },
        tag: '#008DFF', // blue-10
        good: { DEFAULT: '#009B46', bg: '#E6F5EC' },
        bad: { DEFAULT: '#CC1D36', bg: '#FBE8EB' },
        cluster: {
          bma: '#F7BC00',
          ent: '#7C8689',
          fin: '#009B46',
          hos: '#0B74BF',
          mkt: '#CC1D36',
          pfl: '#91C659',
          core: '#002D6B',
        },
      },
      fontFamily: {
        sans: ['"Montserrat Variable"', 'Montserrat', 'Arial', 'sans-serif'],
      },
      letterSpacing: { head: '-0.025em', label: '0.04em' },
    },
  },
  plugins: [],
}
