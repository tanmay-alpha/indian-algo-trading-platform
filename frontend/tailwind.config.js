/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      // Mobile-first approach with explicit named breakpoints
      mobile: '375px',   // iPhone SE / small Android
      tablet: '768px',   // iPad / large phone breakpoint
      laptop: '1024px',  // Small laptop
      desktop: '1280px', // Standard desktop
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        base: 'var(--color-base)',
        panel: 'var(--color-panel)',
        surface: 'var(--color-surface)',
        hover: 'var(--color-hover)',
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          dim: 'var(--color-accent-dim)',
        },
        up: {
          DEFAULT: 'var(--color-up)',
          dim: 'var(--color-up-dim)',
        },
        dn: {
          DEFAULT: 'var(--color-dn)',
          dim: 'var(--color-dn-dim)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          muted: 'var(--color-text-muted)',
          hint: 'var(--color-text-hint)',
        },
        warn: 'var(--color-warn)',

        // Compatibility aliases used by older components.
        primary: 'var(--color-text-primary)',
        muted: 'var(--color-text-muted)',
        hint: 'var(--color-text-hint)',
        strong: 'var(--color-border-light)',
        'border-strong': 'var(--color-border-light)',
        'accent-dim': 'var(--color-accent-dim)',
        'up-dim': 'var(--color-up-dim)',
        'dn-dim': 'var(--color-dn-dim)',
        down: 'var(--color-dn)',
        'down-dim': 'var(--color-dn-dim)',
        'warn-dim': 'rgba(245,158,11,0.12)',
        bg: 'var(--color-base)',
        'bg-2': 'var(--color-panel)',
        'bg-surface': 'var(--color-panel)',
        'panel-2': 'var(--color-surface)',
        'panel-3': 'var(--color-hover)',
        'text-2': 'var(--color-text-muted)',
        'text-dim': 'var(--color-text-muted)',
        'text-faint': 'var(--color-text-hint)',
        info: 'var(--color-accent)',
        'info-dim': 'var(--color-accent-dim)',
        paper: 'var(--color-accent)',
        live: 'var(--color-text-muted)',
        'maet-ink-950': 'var(--color-base)',
        'maet-ink-900': 'var(--color-base)',
        'maet-ink-850': 'var(--color-panel)',
        'maet-ink-800': 'var(--color-surface)',
        'maet-panel': 'var(--color-panel)',
        'maet-glass-bg': 'var(--color-panel)',
        'maet-glass-bg-strong': 'var(--color-surface)',
        'maet-glass-border': 'var(--color-border)',
        'maet-glass-border-strong': 'var(--color-border-light)',
        'maet-text': 'var(--color-text-primary)',
        'maet-text-soft': 'var(--color-text-muted)',
        'maet-text-muted': 'var(--color-text-muted)',
        'maet-text-faint': 'var(--color-text-hint)',
        'maet-cyan': 'var(--color-accent)',
        'maet-blue': 'var(--color-accent)',
        'maet-green': 'var(--color-up)',
        'maet-red': 'var(--color-dn)',
        'maet-amber': 'var(--color-warn)',
        'maet-violet': 'var(--color-accent)',
      },
      fontFamily: {
        mono: ["var(--font-mono, 'JetBrains Mono')", "'Roboto Mono'", 'monospace'],
        sans: ["var(--font-sans, 'DM Sans')", "'Inter'", 'sans-serif'],
        heading: ["var(--font-sans, 'DM Sans')", "'Inter'", 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['11px', { lineHeight: '16px' }],
        base: ['13px', { lineHeight: '19px' }],
        md: ['15px', { lineHeight: '22px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '26px' }],
        '2xl': ['20px', { lineHeight: '28px' }],
        '3xl': ['24px', { lineHeight: '32px' }],
        '4xl': ['32px', { lineHeight: '40px' }],
        '5xl': ['40px', { lineHeight: '48px' }],
      },
      borderRadius: {
        xs: '2px',
        sm: '2px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        card: '4px',
        pill: '4px',
      },
      boxShadow: {
        float: 'none',
        card: 'none',
        glass: 'none',
        raised: 'none',
        inner: 'none',
        modal: 'none',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
