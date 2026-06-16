'use client';
import { useEffect, useState } from 'react';
import type { Preset } from '@/lib/screener';
import { getPresets } from '@/lib/screener';
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  onSelect: (presetId: string) => void;
  activePreset: string | null;
}

export function PresetGrid({ onSelect, activePreset }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPresets().then((p) => {
      setPresets(p);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 text-sm py-4"
        style={{ color: 'var(--text-2)' }}
      >
        <Loader2 size={14} className="animate-spin" /> Loading presets...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className="p-3 border rounded text-left transition-colors"
          style={
            activePreset === p.id
              ? {
                  borderColor: 'var(--accent)',
                  backgroundColor: 'var(--bg-2)',
                }
              : {
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--bg-1)',
                }
          }
        >
          <div className="flex items-center gap-1 mb-1">
            <Sparkles size={12} style={{ color: 'var(--gold)' }} />
            <div
              className="text-[10px] mono uppercase tracking-wider"
              style={{ color: 'var(--text-2)' }}
            >
              Preset
            </div>
          </div>
          <div
            className="text-xs font-medium leading-tight"
            style={{ color: 'var(--text-0)' }}
          >
            {p.name}
          </div>
          <div
            className="text-[10px] mt-1 leading-tight"
            style={{ color: 'var(--text-2)' }}
          >
            {p.description}
          </div>
        </button>
      ))}
    </div>
  );
}
