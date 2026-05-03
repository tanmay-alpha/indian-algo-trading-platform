import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { DataQuality, OperatorState } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ----- Number formatters -----
const inLocale = 'en-IN'

export function fmtPrice(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString(inLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtPct(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function fmtChange(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}`
}

export function fmtVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(2)}Cr`
  if (abs >= 1_00_000) return `${(value / 1_00_000).toFixed(2)}L`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

export function fmtCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(2)} Cr`
  if (abs >= 1_00_000) return `${(value / 1_00_000).toFixed(2)} L`
  return fmtPrice(value)
}

export function fmtTime(timestamp: number | string | null | undefined): string {
  if (!timestamp) return '—:—:—'
  const d = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp)
  if (isNaN(d.getTime())) return '—:—:—'
  return d.toLocaleTimeString(inLocale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function fmtAge(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  return `${Math.floor(ms / 3_600_000)}h`
}

export function priceDirClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'text-text-dim'
  if (value > 0) return 'text-up'
  if (value < 0) return 'text-down'
  return 'text-text-2'
}

// ----- Quality / state helpers -----
export function qualityClass(q: DataQuality | undefined): string {
  switch (q) {
    case 'LIVE':
      return 'text-up bg-up-dim border-up/20'
    case 'STALE':
      return 'text-warn bg-warn-dim border-warn/20'
    case 'DELAYED':
      return 'text-warn bg-warn-dim border-warn/20'
    case 'UNAVAILABLE':
      return 'text-text-dim bg-white/[0.03] border-border'
    case 'BACKEND OFFLINE':
      return 'text-down bg-down-dim border-down/25'
    case 'MOCK':
      return 'text-info bg-info-dim border-info/20'
    case 'LOADING':
      return 'text-info bg-info-dim border-info/20'
    case 'ERROR':
      return 'text-down bg-down-dim border-down/25'
    default:
      return 'text-text-dim bg-white/[0.03] border-border'
  }
}

export function operatorClass(state: OperatorState): string {
  switch (state) {
    case 'ONLINE':
      return 'text-up bg-up-dim border-up/20'
    case 'DEGRADED':
      return 'text-warn bg-warn-dim border-warn/20'
    case 'STALE':
      return 'text-warn bg-warn-dim border-warn/20'
    case 'OFFLINE':
      return 'text-down bg-down-dim border-down/25'
    case 'BACKEND OFFLINE':
      return 'text-down bg-down-dim border-down/25'
    case 'LOCKED':
      return 'text-text-dim bg-white/[0.04] border-border-strong'
    case 'UNAVAILABLE':
    default:
      return 'text-text-dim bg-white/[0.03] border-border'
  }
}

export function operatorDot(state: OperatorState): string {
  switch (state) {
    case 'ONLINE':
      return 'bg-up shadow-[0_0_6px_rgba(22,199,132,0.6)]'
    case 'DEGRADED':
    case 'STALE':
      return 'bg-warn'
    case 'OFFLINE':
    case 'BACKEND OFFLINE':
      return 'bg-down'
    case 'LOCKED':
      return 'bg-locked'
    default:
      return 'bg-text-faint'
  }
}

// ----- ID gen -----
export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

// ----- Data quality from age -----
export function qualityFromAge(
  lastTickMs: number | null,
  backendOk: boolean,
  loading: boolean
): DataQuality {
  if (loading) return 'LOADING'
  if (!backendOk) return 'BACKEND OFFLINE'
  if (lastTickMs == null) return 'UNAVAILABLE'
  const age = Date.now() - lastTickMs
  if (age < 3_000) return 'LIVE'
  if (age < 8_000) return 'DELAYED'
  return 'STALE'
}
