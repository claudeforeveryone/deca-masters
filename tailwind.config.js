/** @type {import('tailwindcss').Config} */
// Design tokens taken from deca.org (webflow CSS variables + career cluster colours).
// Shape rule: `rounded-soft` (4px) for buttons, inputs, avatars and the notification UI; `rounded-box` (10px)
// for cards, panels and bordered boxes (applied automatically in index.css). Everything else is square.
const square = { ...Object.fromEntries(['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', '3xl', 'full'].map((k) => [k, '0px'])), soft: '4px', box: '10px' }

const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  // Settings > Appearance puts data-theme="dark" on <html> (see src/prefs.ts).
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: square,
    extend: {
      // Themeable colours are CSS variables (RGB channels, light values noted here) set in index.css, so dark
      // mode can redefine them. The rest are fixed.
      colors: {
        // Text: headings, body, secondary. Used consistently everywhere.
        ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3') }, // #141414 / #333333 / #666666
        line: { DEFAULT: v('line'), strong: v('line-strong') }, // #E4E4E4 / #B1B1B1
        canvas: v('canvas'), // #F2F4F7, DECA grey-001 panels
        surface: v('surface'), // #FFFFFF, the page, cards and inputs
        brand: { DEFAULT: v('brand'), hover: v('brand-hover'), press: v('brand-press') }, // #0072CE / #055CA8 / #174783, blue-04 / 05 / 06
        tint: { DEFAULT: v('tint'), 2: v('tint-2'), 3: v('tint-3') }, // #EFF6FC / #A1CEEF / #70B0E0, blue-001 / 01 / 02
        navy: { DEFAULT: v('navy'), deep: '#071634', midnight: '#1C283F', footer: '#1F2A32' }, // #002D6B
        tag: '#008DFF', // blue-10
        good: { DEFAULT: v('good'), bg: v('good-bg') }, // #009B46 / #E6F5EC
        bad: { DEFAULT: v('bad'), bg: v('bad-bg') }, // #CC1D36 / #FBE8EB
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
