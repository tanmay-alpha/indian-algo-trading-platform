/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      // Mobile-first approach with explicit named breakpoints
      sm: '640px',
      md: '768px',
      lg: '1024px',
      mobile: '375px',   // iPhone SE / small Android
      tablet: '768px',   // iPad / large phone breakpoint
      laptop: '1024px',  // Small laptop
      desktop: '1280px', // Standard desktop
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Lovable/shadcn-style tokens (CSS vars defined in :root in globals.css).
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',
        'panel-elevated': 'var(--panel-elevated)',
        bull: 'var(--bull)',
        'bull-candle': 'var(--bull-candle)',
        bear: 'var(--bear)',
        'bear-candle': 'var(--bear-candle)',
        grid: 'var(--grid)',
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },

        // Depth-first precision palette (overrides existing aliases).
        void: '#080A10',
        base: 'var(--color-base)',
        panel: 'var(--color-panel)',
        surface: '#161B27',
        elevated: '#1E2535',
        hover: 'var(--color-hover)',
        // Accents.
        gold: {
          DEFAULT: '#F0C040',
          bright: '#FFD700',
        },
        parchment: '#E8E6DF',
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          dim: 'var(--color-accent-dim)',
          soft: 'var(--color-accent-soft)',
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
        warn: {
          DEFAULT: 'var(--color-warn)',
          dim: 'var(--color-warn-dim)',
        },

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
        'warn-dim': 'var(--color-warn-dim)',
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
        sans: ["var(--font-sans, 'Inter')", 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', '"Source Serif Pro"', 'Georgia', 'serif'],
        heading: ["var(--font-sans, 'Inter')", 'system-ui', 'sans-serif'],
        data: ['"JetBrains Mono"', '"Roboto Mono"', 'monospace'],
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
        float: '0 4px 24px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.06)',
        card: '0 4px 24px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.06)',
        glow: '0 0 20px rgba(240,192,64,0.25)',
        glass: '0 4px 24px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.06)',
        raised: '0 4px 24px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.06)',
        inner: 'inset 0 0.5px 0 rgba(255,255,255,0.06)',
        modal: '0 24px 60px rgba(0,0,0,0.6), inset 0 0.5px 0 rgba(255,255,255,0.06)',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        goldPulse: {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.4' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        'gold-pulse': 'goldPulse 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.25s ease-out both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
