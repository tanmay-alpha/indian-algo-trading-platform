/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b0e14',
        panel: 'rgba(23, 27, 34, 0.7)',
        border: 'rgba(255, 255, 255, 0.08)',
        accent: '#3b82f6',
        success: '#10b981',
        danger: '#ef4444',
        'text-main': '#f8fafc',
        'text-dim': '#94a3b8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: {
        glass: '10px',
      },
    },
  },
  plugins: [],
}
