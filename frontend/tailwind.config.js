/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: 'var(--bg)',
        'bg-2': 'var(--bg-2)',
        panel: 'var(--panel)',
        'panel-2': 'var(--panel-2)',
        'panel-3': 'var(--panel-3)',
        // Borders
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'border-accent': 'var(--border-accent)',
        // Text
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-dim': 'var(--text-dim)',
        'text-faint': 'var(--text-faint)',
        // Market state
        up: 'var(--up)',
        'up-dim': 'var(--up-dim)',
        down: 'var(--down)',
        'down-dim': 'var(--down-dim)',
        // System / status
        warn: 'var(--warn)',
        'warn-dim': 'var(--warn-dim)',
        info: 'var(--info)',
        'info-dim': 'var(--info-dim)',
        locked: 'var(--locked)',
        // Mode
        paper: 'var(--paper)',
        live: 'var(--live)',
        // Aliases (legacy components)
        background: 'var(--bg)',
        accent: 'var(--info)',
        success: 'var(--up)',
        danger: 'var(--down)',
        warning: 'var(--warn)',
        'text-main': 'var(--text)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '15px' }],
        sm: ['12px', { lineHeight: '16px' }],
        base: ['13px', { lineHeight: '18px' }],
        md: ['14px', { lineHeight: '20px' }],
      },
      spacing: {
        rail: '68px',
        watchlist: '324px',
        drawer: '360px',
        topbar: '48px',
        statusbar: '26px',
        dock: '260px',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.02) inset',
        modal: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px var(--border-strong)',
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        'flash-up': 'flashUp 0.45s ease-out',
        'flash-down': 'flashDown 0.45s ease-out',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        flashUp: {
          '0%': { backgroundColor: 'rgba(22,199,132,0.22)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashDown: {
          '0%': { backgroundColor: 'rgba(234,57,67,0.22)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
}
