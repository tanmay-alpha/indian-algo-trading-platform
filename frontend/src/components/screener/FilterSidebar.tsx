'use client';
import { FilterGroup, RangeInput, MultiSelect } from './FilterGroup';
import type { FilterSpec, RangeValue } from '@/lib/screener';

interface Props {
  filters: FilterSpec;
  onChange: (filters: FilterSpec) => void;
  onClear: () => void;
}

const SECTOR_OPTIONS = [
  'Banking',
  'IT',
  'Auto',
  'Pharma',
  'FMCG',
  'Energy',
  'Metals',
  'Services',
  'Consumer',
  'Finance',
  'Industrial',
  'Power',
  'Realty',
  'Retail',
  'Telecom',
  'Cement',
  'Chemicals',
  'Healthcare',
  'Mining',
];

function emptyRange(): RangeValue {
  return [null, null];
}

function getRange(filters: FilterSpec, key: string): RangeValue {
  const v = filters[key];
  if (Array.isArray(v) && v.length === 2) {
    return v as RangeValue;
  }
  return emptyRange();
}

function getStringArray(filters: FilterSpec, key: string): string[] {
  const v = filters[key];
  return Array.isArray(v) && typeof v[0] === 'string' ? (v as string[]) : [];
}

export function FilterSidebar({ filters, onChange, onClear }: Props) {
  const updateFilter = (key: string, value: unknown) => {
    const newFilters: FilterSpec = { ...filters };
    if (
      value === null ||
      value === undefined ||
      (Array.isArray(value) &&
        ((value as unknown[]).length === 0 ||
          (Array.isArray(value) &&
            (value as RangeValue)[0] === null &&
            (value as RangeValue)[1] === null)))
    ) {
      delete newFilters[key];
    } else {
      newFilters[key] = value as string[] | RangeValue;
    }
    onChange(newFilters);
  };

  return (
    <div
      className="w-72 flex-shrink-0 border rounded p-4 h-fit sticky top-4"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="text-sm font-medium"
          style={{ color: 'var(--text-0)' }}
        >
          Filters
        </div>
        <button
          onClick={onClear}
          className="text-[10px] hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Clear all
        </button>
      </div>

      <FilterGroup title="Sector">
        <MultiSelect
          label=""
          options={SECTOR_OPTIONS}
          value={getStringArray(filters, 'sector')}
          onChange={(v) => updateFilter('sector', v)}
        />
      </FilterGroup>

      <FilterGroup title="Market Cap (Cr)">
        <RangeInput
          label="Range"
          value={getRange(filters, 'marketCap')}
          onChange={(v) => updateFilter('marketCap', v)}
        />
      </FilterGroup>

      <FilterGroup title="Valuation">
        <RangeInput
          label="P/E"
          value={getRange(filters, 'pe')}
          onChange={(v) => updateFilter('pe', v)}
        />
        <RangeInput
          label="P/B"
          value={getRange(filters, 'pb')}
          onChange={(v) => updateFilter('pb', v)}
        />
        <RangeInput
          label="EV/EBITDA"
          value={getRange(filters, 'ev_ebitda')}
          onChange={(v) => updateFilter('ev_ebitda', v)}
        />
      </FilterGroup>

      <FilterGroup title="Returns">
        <RangeInput
          label="ROE %"
          value={getRange(filters, 'roe')}
          onChange={(v) => updateFilter('roe', v)}
        />
        <RangeInput
          label="Profit Margin %"
          value={getRange(filters, 'profitMargin')}
          onChange={(v) => updateFilter('profitMargin', v)}
        />
        <RangeInput
          label="Revenue Growth %"
          value={getRange(filters, 'revenueGrowth')}
          onChange={(v) => updateFilter('revenueGrowth', v)}
        />
      </FilterGroup>

      <FilterGroup title="Balance Sheet">
        <RangeInput
          label="Debt/Equity"
          value={getRange(filters, 'debtToEquity')}
          onChange={(v) => updateFilter('debtToEquity', v)}
          step={0.1}
        />
        <RangeInput
          label="Current Ratio"
          value={getRange(filters, 'currentRatio')}
          onChange={(v) => updateFilter('currentRatio', v)}
          step={0.1}
        />
      </FilterGroup>

      <FilterGroup title="Dividends">
        <RangeInput
          label="Dividend Yield %"
          value={getRange(filters, 'dividendYield')}
          onChange={(v) => updateFilter('dividendYield', v)}
          step={0.1}
        />
      </FilterGroup>

      <FilterGroup title="Price Action">
        <RangeInput
          label="Today's Change %"
          value={getRange(filters, 'changePct')}
          onChange={(v) => updateFilter('changePct', v)}
          step={0.1}
        />
        <RangeInput
          label="Price (₹)"
          value={getRange(filters, 'price')}
          onChange={(v) => updateFilter('price', v)}
        />
      </FilterGroup>
    </div>
  );
}
