/** @type {import('tailwindcss').Config} */
// Palette: navy (ink), DECA blue (brand, the only accent), light blue (tint), white.
// Radius system: cards 12px (rounded-xl), controls 8px (rounded-lg), badges 6px (rounded-md).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0B1F3A', 2: '#34445C', 3: '#5E6B80' },
        line: { DEFAULT: '#E3E8EF', strong: '#CBD4E0' },
        canvas: '#F5F7FA',
        brand: { DEFAULT: '#0B6FCB', hover: '#0A5FAE', press: '#094F91' },
        tint: { DEFAULT: '#EBF4FD', 2: '#D6E8FA', 3: '#A9CEF3' },
        good: { DEFAULT: '#127A57', bg: '#E8F5EF' },
        bad: { DEFAULT: '#B93A28', bg: '#FBEDEA' },
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(11,31,58,.05)',
        pop: '0 8px 24px -6px rgba(11,31,58,.14), 0 2px 6px rgba(11,31,58,.06)',
      },
    },
  },
  plugins: [],
}
