export const TOKENS = {
  color: {
    bg: {
      base: '#0B0E17',
      panel: '#111420',
      surface: '#181C2E',
      hover: '#1E2235',
    },
    accent: {
      DEFAULT: '#3B82F6',
      dim: '#3B82F615',
    },
    semantic: {
      up: '#22C55E',
      dn: '#EF4444',
      warn: '#F59E0B',
    },
    text: {
      primary: '#E8EAF0',
      muted: '#6B7280',
      hint: '#374151',
    },
    border: {
      DEFAULT: '#ffffff0f',
      strong: '#ffffff1a',
    },
  },
  font: {
    mono: "'JetBrains Mono', monospace",
    ui: "'DM Sans', sans-serif",
  },
  cssVar: {
    bgBase: 'var(--color-bg-base)',
    bgPanel: 'var(--color-bg-panel)',
    bgSurface: 'var(--color-bg-surface)',
    bgHover: 'var(--color-bg-hover)',
    accent: 'var(--color-accent)',
    accentDim: 'var(--color-accent-dim)',
    up: 'var(--color-up)',
    dn: 'var(--color-dn)',
    warn: 'var(--color-warn)',
    textPrimary: 'var(--color-text-primary)',
    textMuted: 'var(--color-text-muted)',
    textHint: 'var(--color-text-hint)',
    border: 'var(--color-border)',
    borderStrong: 'var(--color-border-strong)',
    fontMono: 'var(--font-mono)',
    fontUi: 'var(--font-ui)',
  },
} as const

export type Tokens = typeof TOKENS
