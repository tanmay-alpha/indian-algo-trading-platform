import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { DataQuality, NseMarketSession, OperatorState } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ----- Number formatters -----
const inLocale = 'en-IN'

export function fmtPrice(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '\u2014'
  return value.toLocaleString(inLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtPct(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '\u2014'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function fmtChange(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '\u2014'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}`
}

export function fmtVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '\u2014'
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(2)}Cr`
  if (abs >= 1_00_000) return `${(value / 1_00_000).toFixed(2)}L`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

export function fmtCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '\u2014'
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(2)} Cr`
  if (abs >= 1_00_000) return `${(value / 1_00_000).toFixed(2)} L`
  return fmtPrice(value)
}

export function fmtTime(timestamp: number | string | null | undefined): string {
  if (!timestamp) return '--:--:--'
  const d = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp)
  if (isNaN(d.getTime())) return '--:--:--'
  return d.toLocaleTimeString(inLocale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function fmtAge(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '\u2014'
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
    case 'WAITING':
      return 'text-text-2 bg-white/[0.03] border-border'
    case 'READY':
      return 'text-up bg-up-dim border-up/20'
    case 'WARMING':
      return 'text-info bg-info-dim border-info/20'
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
    case 'MARKET CLOSED':
    case 'PRE-MARKET':
    case 'POST-MARKET':
      return 'text-warn bg-warn-dim border-warn/20'
    default:
      return 'text-text-dim bg-white/[0.03] border-border'
  }
}

export function operatorClass(state: OperatorState): string {
  switch (state) {
    case 'ONLINE':
      return 'text-up bg-up-dim border-up/20'
    case 'DEGRADED':
    case 'RECONNECTING':
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
    case 'RECONNECTING':
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

export function isMarketHours(): boolean {
  return getNseMarketSession() === 'OPEN'
}

export function getNseMarketSession(now: Date = new Date()): NseMarketSession {
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = ist.getDay()
  if (day === 0 || day === 6) return 'WEEKEND'
  const h = ist.getHours()
  const m = ist.getMinutes()
  const minutes = h * 60 + m
  if (minutes < 9 * 60 + 15) return 'PRE_MARKET'
  if (minutes >= 15 * 60 + 30) return 'POST_MARKET'
  return 'OPEN'
}

export function marketSessionLabel(): 'PRE-MARKET' | 'POST-MARKET' | 'MARKET CLOSED' | 'LIVE' {
  const session = getNseMarketSession()
  if (session === 'OPEN') return 'LIVE'
  if (session === 'PRE_MARKET') return 'PRE-MARKET'
  if (session === 'POST_MARKET') return 'POST-MARKET'
  return 'MARKET CLOSED'
}

export function marketNoDataLabel(): 'WAITING' | 'PRE-MARKET' | 'POST-MARKET' | 'MARKET CLOSED' {
  const session = marketSessionLabel()
  return session === 'LIVE' ? 'WAITING' : session
}

export type UiSeverity = 'ok' | 'info' | 'warn' | 'bad' | 'muted' | 'locked'

export interface UiStatusMeta {
  label: string
  shortLabel: string
  severity: UiSeverity
  dotClass: string
  badgeClass: string
}

export function uiStatusMeta(status: string | null | undefined): UiStatusMeta {
  const normalized = String(status || 'UNAVAILABLE').replace(/_/g, ' ').toUpperCase()
  const compact = normalized.replace(/\s+/g, ' ')
  const severity = severityForStatus(compact)
  return {
    label: compact,
    shortLabel: compact,
    severity,
    dotClass: dotClassForSeverity(severity),
    badgeClass: badgeClassForSeverity(severity),
  }
}

function severityForStatus(status: string): UiSeverity {
  if (['ONLINE', 'LIVE', 'READY', 'CONNECTED', 'OPEN', 'MARKET OPEN'].includes(status)) return 'ok'
  if (['LOCKED', 'PAPER LOCKED'].includes(status)) return 'locked'
  if (['CONNECTING', 'RECONNECTING', 'WAKING', 'WARMING', 'WAITING', 'STALE', 'DELAYED'].includes(status)) return 'warn'
  if (['OFFLINE', 'BACKEND OFFLINE', 'ERROR', 'DISCONNECTED'].includes(status)) return 'bad'
  if (['POST-MARKET', 'PRE-MARKET', 'MARKET CLOSED', 'WEEKEND'].includes(status)) return 'info'
  return 'muted'
}

function dotClassForSeverity(severity: UiSeverity): string {
  if (severity === 'ok') return 'bg-up shadow-[0_0_6px_rgba(22,199,132,0.55)]'
  if (severity === 'warn') return 'bg-warn'
  if (severity === 'bad') return 'bg-down'
  if (severity === 'info') return 'bg-info'
  if (severity === 'locked') return 'bg-locked'
  return 'bg-text-faint'
}

function badgeClassForSeverity(severity: UiSeverity): string {
  if (severity === 'ok') return 'text-up border-up/20 bg-up-dim'
  if (severity === 'warn') return 'text-warn border-warn/20 bg-warn-dim'
  if (severity === 'bad') return 'text-down border-down/25 bg-down-dim'
  if (severity === 'info') return 'text-info border-info/20 bg-info-dim'
  if (severity === 'locked') return 'text-text-2 border-border-strong bg-white/[0.04]'
  return 'text-text-dim border-border bg-white/[0.03]'
}
