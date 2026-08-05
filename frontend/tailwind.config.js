/** @type {import('tailwindcss').Config} */
// Linear/Vercel dark-theme palette. The app is dark-only, so darkMode 'class'
// is paired with a hardcoded <html class="dark"> in index.html.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // High-contrast, bespoke slate palette
        arch: {
          950: '#090a0c', // main canvas
          900: '#111317', // surface / panel
          850: '#15181e', // elevated card
          800: '#1c2029', // structural card hover
          700: '#282e3b', // border / outline
          border: '#242830', // sharp 1px dividers
        },
        // Intentional sharp accent color (Electric Amber)
        amber: {
          500: '#f59e0b',
          400: '#fbbf24',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Syne"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      boxShadow: {
        sharp: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
        amber: '0 0 15px -3px rgba(245, 158, 11, 0.3)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Modal entrance: subtle scale + fade.
        'modal-in': {
          '0%': { opacity: '0', transform: 'scale(0.97) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        // Context-menu pop: scale from the click point.
        'menu-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-in-out',
      },
    },
  },
  plugins: [],
}
