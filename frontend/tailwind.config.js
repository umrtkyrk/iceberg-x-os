import { brandColors, inkColors, themedPalette, themePalettePlugin } from './tailwind.palette.js';

/** @type {import('tailwindcss').Config} */
export default {
  // Dark mode is a class on <html>, set by ThemeProvider. Most colours switch
  // through the themed palette (see tailwind.palette.js); `dark:` is for the
  // exceptions.
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: { ...brandColors, ink: inkColors },
      backgroundColor: themedPalette.backgroundColor,
      textColor: themedPalette.textColor,
      borderColor: themedPalette.borderColor,
      ringColor: themedPalette.ringColor,
      ringOffsetColor: themedPalette.ringOffsetColor,
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        premium: '0 24px 60px -20px rgba(17, 17, 17, 0.08)',
        subtle: '0 8px 24px -10px rgba(17, 17, 17, 0.06)',
      },
      // `animate-fadeIn` was used in ~10 components but never defined, so no
      // dropdown or panel ever animated.
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.18s ease-out',
      }
    },
  },
  plugins: [themePalettePlugin],
}
