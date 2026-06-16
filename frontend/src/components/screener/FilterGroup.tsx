'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface FilterGroupProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function FilterGroup({
  title,
  children,
  defaultOpen = true,
}: FilterGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="border-b py-3"
      style={{ borderBottomColor: 'var(--border)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <span
          className="text-[11px] mono uppercase tracking-wider font-medium"
          style={{ color: 'var(--text-1)' }}
        >
          {title}
        </span>
        {open ? (
          <ChevronDown size={14} style={{ color: 'var(--text-2)' }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--text-2)' }} />
        )}
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

export function RangeInput({
  label,
  value,
  onChange,
  unit = '',
  step = 1,
}: {
  label: string;
  value: [number | null, number | null];
  onChange: (v: [number | null, number | null]) => void;
  unit?: string;
  step?: number;
}) {
  return (
    <div>
      <div
        className="text-[11px] mb-1"
        style={{ color: 'var(--text-2)' }}
      >
        {label}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="Min"
          value={value[0] ?? ''}
          onChange={(e) =>
            onChange([
              e.target.value ? +e.target.value : null,
              value[1],
            ])
          }
          step={step}
          className="w-full border rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent)] font-mono"
          style={{
            backgroundColor: 'var(--bg-2)',
            borderColor: 'var(--border)',
            color: 'var(--text-0)',
          }}
        />
        <span className="text-xs" style={{ color: 'var(--text-2)' }}>
          to
        </span>
        <input
          type="number"
          placeholder="Max"
          value={value[1] ?? ''}
          onChange={(e) =>
            onChange([
              value[0],
              e.target.value ? +e.target.value : null,
            ])
          }
          step={step}
          className="w-full border rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent)] font-mono"
          style={{
            backgroundColor: 'var(--bg-2)',
            borderColor: 'var(--border)',
            color: 'var(--text-0)',
          }}
        />
        {unit && (
          <span className="text-xs" style={{ color: 'var(--text-2)' }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      {label && (
        <div
          className="text-[11px] mb-2"
          style={{ color: 'var(--text-2)' }}
        >
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => {
              const newVal = value.includes(opt)
                ? value.filter((v) => v !== opt)
                : [...value, opt];
              onChange(newVal);
            }}
            className="text-[10px] px-2 py-1 rounded border font-mono transition-colors"
            style={
              value.includes(opt)
                ? {
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    borderColor: 'var(--accent)',
                  }
                : {
                    backgroundColor: 'var(--bg-2)',
                    color: 'var(--text-1)',
                    borderColor: 'var(--border)',
                  }
            }
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
