import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fp: {
          'punch-red': '#E63946',
          'honeydew': '#F1FAEE',
          'frosted': '#A8DADC',
          'cerulean': '#457B9D',
          'navy': '#1D3557',
          'bg-dark': '#0c1220',
          'card-dark': '#131b2e',
          'hover-dark': '#1a2440',
          'sidebar-dark': '#0a0f1a',
          'text-secondary': '#8a9bb5',
          'text-tertiary': '#5a6a82',
          'border-dark': 'rgba(69,123,157,0.15)',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
