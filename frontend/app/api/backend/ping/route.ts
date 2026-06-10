import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const baseUrl = backendBaseUrl()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1200)

  try {
    const response = await fetch(`${baseUrl}/ping`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    return NextResponse.json({
      reachable: response.ok,
      status: response.ok ? 'online' : 'degraded',
    })
  } catch {
    return NextResponse.json({
      reachable: false,
      status: 'degraded',
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
