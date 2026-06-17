import { NextRequest, NextResponse } from 'next/server';

// Server-only backend base URL. Falls back to NEXT_PUBLIC_BACKEND_URL, then localhost:8000 for dev.
const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:8000'
).replace(/\/+$/, '');

// Server-only admin token. NEVER reference this from a client component —
// it would leak into the browser bundle.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

// Endpoints that require the backend's admin token. Matched by the leading
// path segment(s) the browser sends through the proxy. Everything else
// forwards without the header.
const ADMIN_PREFIXES: readonly string[] = [
  'broker/account',
  'strategies/configs',
  'strategies/signals/pending',
  'strategies/signals/', // approve-paper / dismiss — both need admin
  'strategies/backtest',
  'strategies/scheduler',
  'candles/', // covers candles/{symbol}/fetch (the public GET candles/{symbol} also goes through here; the header is harmless for it)
  'watchlists',
  'manual-order',
  'live',
  'oms',
  'account-reconciliation',
  'broker-history',
  'safety',
];

function needsAdmin(path: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path: string[] }> };

function buildBackendHeaders(path: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (needsAdmin(path) && ADMIN_TOKEN) {
    headers['x-admin-token'] = ADMIN_TOKEN;
  }
  return headers;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const joined = path.join('/');
  const url = `${BACKEND}/${joined}${req.nextUrl.search}`;
  try {
    const res = await fetch(url, {
      headers: buildBackendHeaders(joined),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'proxy error' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const joined = path.join('/');
  const url = `${BACKEND}/${joined}`;
  try {
    const body = await req.json();
    const res = await fetch(url, {
      method: 'POST',
      headers: buildBackendHeaders(joined),
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'proxy error' },
      { status: 502 }
    );
  }
}
