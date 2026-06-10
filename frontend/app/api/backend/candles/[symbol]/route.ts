import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ symbol: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { symbol } = await context.params
  const timeframe = request.nextUrl.searchParams.get('timeframe') || '5m'
  const baseUrl = backendBaseUrl()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)

  try {
    const url = `${baseUrl}/candles/${encodeURIComponent(symbol)}?timeframe=${encodeURIComponent(timeframe)}`
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({
      candles: [],
      source: 'demo-fallback',
      error: 'Backend candles unavailable',
    })
  } finally {
    clearTimeout(timeout)
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
