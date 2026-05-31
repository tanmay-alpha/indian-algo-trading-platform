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
        bg:          'var(--bg)',
        'bg-2':      'var(--bg-2)',
        'bg-surface':'var(--bg-surface)',
        panel:       'var(--panel)',
        'panel-2':   'var(--panel-2)',
        'panel-3':   'var(--panel-3)',
        // Borders
        border:          'var(--border)',
        'border-strong': 'var(--border-strong)',
        'border-accent': 'var(--border-accent)',
        'border-card':   'var(--border-card)',
        // Text
        text:        'var(--text)',
        'text-2':    'var(--text-2)',
        'text-dim':  'var(--text-dim)',
        'text-faint':'var(--text-faint)',
        // Market
        up:          'var(--up)',
        'up-dim':    'var(--up-dim)',
        down:        'var(--down)',
        'down-dim':  'var(--down-dim)',
        // Status
        warn:        'var(--warn)',
        'warn-dim':  'var(--warn-dim)',
        info:        'var(--info)',
        'info-dim':  'var(--info-dim)',
        locked:      'var(--locked)',
        violet:      'var(--violet)',
        // Mode
        paper: 'var(--paper)',
        live:  'var(--live)',
      },
      fontFamily: {
        sans: ['Inter', 'var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs:    ['11px', { lineHeight: '16px' }],
        sm:    ['12px', { lineHeight: '18px' }],
        base:  ['14px', { lineHeight: '20px' }],
        md:    ['15px', { lineHeight: '22px' }],
        lg:    ['16px', { lineHeight: '24px' }],
        xl:    ['18px', { lineHeight: '26px' }],
        '2xl': ['20px', { lineHeight: '28px' }],
        '3xl': ['24px', { lineHeight: '32px' }],
      },
      spacing: {
        'nav':     'var(--bottom-nav-h)',
        'header':  'var(--top-header-h)',
        'safe-b':  'env(safe-area-inset-bottom, 0px)',
      },
      borderRadius: {
        card:   '16px',
        card2:  '20px',
        pill:   '100px',
      },
      boxShadow: {
        card:    '0 20px 60px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset',
        modal:   '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px var(--border-strong)',
        up:      '0 0 16px rgba(22, 199, 132, 0.25)',
        down:    '0 0 16px rgba(234, 57, 67, 0.25)',
        cyan:    '0 0 20px rgba(56, 189, 248, 0.2)',
      },
      borderWidth: {
        '3': '3px',
      },
      animation: {
        'pulse-soft':  'pulseSoft 2.4s ease-in-out infinite',
        'flash-up':    'flashUp 0.45s ease-out',
        'flash-down':  'flashDown 0.45s ease-out',
        'slide-up':    'slideInBottom 0.28s cubic-bezier(0.34, 1.2, 0.64, 1)',
        'fade-in':     'fadeIn 0.18s ease-out',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        flashUp: {
          '0%':   { backgroundColor: 'rgba(22,199,132,0.22)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashDown: {
          '0%':   { backgroundColor: 'rgba(234,57,67,0.22)' },
          '100%': { backgroundColor: 'transparent' },
        },
        slideInBottom: {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
