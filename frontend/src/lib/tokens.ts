export const TOKENS = {
  base: '#0c0d12',
  panel: '#131722',
  surface: '#1e222d',
  hover: '#252938',
  border: '#2a2e39',
  borderLight: '#363a47',
  textPrimary: '#e0e3eb',
  textMuted: '#787b86',
  textHint: '#4c515f',
  accent: '#2962ff',
  up: '#26a69a',
  dn: '#ef5350',
  warn: '#f59e0b',
  fontMono: 'JetBrains Mono, Roboto Mono, monospace',
  fontSans: 'DM Sans, Inter, sans-serif',
} as const

export type TokenKey = keyof typeof TOKENS
