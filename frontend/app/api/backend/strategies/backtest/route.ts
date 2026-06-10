import { NextRequest, NextResponse } from 'next/server'
import { defaultStrategyConfig, generateDemoBacktestResult } from '@/lib/demoStrategy'
import type { StrategyConfig } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const payload = normalizePayload(await safeJson(request))
  const baseUrl = backendBaseUrl()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)

  try {
    const response = await fetch(`${baseUrl}/strategies/backtest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return NextResponse.json(await response.json())
  } catch {
    return NextResponse.json({
      ...generateDemoBacktestResult(payload),
      demo: true,
    })
  } finally {
    clearTimeout(timeout)
  }
}

function normalizePayload(value: unknown): StrategyConfig {
  if (!value || typeof value !== 'object') return defaultStrategyConfig()
  const record = value as Partial<StrategyConfig>
  return {
    ...defaultStrategyConfig(record.symbol || 'RELIANCE', record.strategy_name || undefined),
    ...record,
    params: record.params && typeof record.params === 'object' ? record.params : {},
  }
}

async function safeJson(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function backendBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'
  ).replace(/\/+$/, '')
}
