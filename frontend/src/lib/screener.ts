export type RangeValue = [number | null, number | null];
export type FilterSpec = {
  [key: string]: string[] | RangeValue | undefined;
};

export interface ScreenerRequest {
  filters: FilterSpec;
  limit?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface ScreenerResult {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
  ltp: number | null;
  changePct: number | null;
  marketCap: number;
  pe: number | null;
  pb: number | null;
  ps?: number | null;
  roe: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  beta?: number | null;
  volume: number;
  pctFrom52wHigh?: number | null;
  pctFrom52wLow?: number | null;
  '52wHigh'?: number | null;
  '52wLow'?: number | null;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
}

const API =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

export async function runScreener(
  filters: FilterSpec,
  limit = 50,
  sortBy = 'marketCap',
  sortDir: 'asc' | 'desc' = 'desc',
): Promise<ScreenerResult[]> {
  const res = await fetch(`${API}/api/screener/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters,
      limit,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
  });
  if (!res.ok) throw new Error(`Screener API error: ${res.status}`);
  const data = await res.json();
  return data.stocks || [];
}

export async function getPresets(): Promise<Preset[]> {
  try {
    const res = await fetch(`${API}/api/screener/presets`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.presets || [];
  } catch {
    return [];
  }
}

export async function runPreset(
  presetId: string,
  limit = 25,
): Promise<ScreenerResult[]> {
  try {
    const res = await fetch(
      `${API}/api/screener/preset/${presetId}?limit=${limit}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.stocks || [];
  } catch {
    return [];
  }
}

export interface FilterSchemaEntry {
  type: 'range' | 'multi';
  unit?: string;
  options?: string[];
}

export async function getFilterSchema(): Promise<Record<string, FilterSchemaEntry>> {
  try {
    const res = await fetch(`${API}/api/screener/filters`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.schema || {};
  } catch {
    return {};
  }
}
