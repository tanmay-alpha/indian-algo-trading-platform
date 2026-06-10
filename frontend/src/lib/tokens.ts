export const TOKENS = {
  base: '#0B0D13',
  panel: '#0F1117',
  surface: '#151822',
  hover: 'rgba(240,192,64,0.06)',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(240,192,64,0.35)',
  textPrimary: '#E8E6DF',
  textMuted: '#6B6A65',
  textHint: '#3D3C39',
  accent: '#F0C040',
  accentDim: 'rgba(240,192,64,0.12)',
  accentSoft: 'rgba(240,192,64,0.06)',
  up: '#4ADE80',
  upDim: 'rgba(74,222,128,0.12)',
  dn: '#F87171',
  dnDim: 'rgba(248,113,113,0.12)',
  warn: '#F0C040',
  warnDim: 'rgba(240,192,64,0.12)',
  fontMono: 'JetBrains Mono, Roboto Mono, monospace',
  fontSans: 'Inter, system-ui, sans-serif',
} as const

export type TokenKey = keyof typeof TOKENS
