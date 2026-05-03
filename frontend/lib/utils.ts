import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, decimals: number = 2): string {
  return price.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 10000000) {
    return `${(value / 10000000).toFixed(2)} Cr`
  }
  if (absValue >= 100000) {
    return `${(value / 100000).toFixed(2)} L`
  }
  return formatPrice(value)
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function getPriceChangeClass(change: number): string {
  if (change > 0) return 'text-success'
  if (change < 0) return 'text-danger'
  return 'text-text-dim'
}

export function getSignalClass(signal: string): string {
  switch (signal) {
    case 'BUY':
      return 'bg-success/10 text-success border-success/20'
    case 'SELL':
      return 'bg-danger/10 text-danger border-danger/20'
    default:
      return 'bg-white/5 text-text-dim border-white/10'
  }
}
