'use client';
import { useState, useEffect } from 'react';
import { FilterSidebar } from '@/components/screener/FilterSidebar';
import { PresetGrid } from '@/components/screener/PresetGrid';
import { ScreenerTable } from '@/components/screener/ScreenerTable';
import {
  runScreener,
  runPreset,
  type FilterSpec,
  type ScreenerResult,
} from '@/lib/screener';
import { Save, FolderOpen, Trash2 } from 'lucide-react';

interface SavedScreen {
  name: string;
  filters: FilterSpec;
}

export default function ScreenerPage() {
  const [filters, setFilters] = useState<FilterSpec>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('marketCap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('maet_saved_screens');
    if (stored) {
      try {
        setSavedScreens(JSON.parse(stored));
      } catch {
        // ignore corrupt localStorage data
      }
    }
  }, []);

  const executeFilters = async () => {
    setLoading(true);
    try {
      const r = await runScreener(filters, 50, sortBy, sortDir);
      setResults(r);
    } catch (e) {
      console.error(e);
      setResults([]);
    }
    setLoading(false);
  };

  // Debounced filter execution
  useEffect(() => {
    if (activePreset) return;
    if (Object.keys(filters).length === 0) {
      setResults([]);
      return;
    }
    const timer = setTimeout(executeFilters, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sortBy, sortDir, activePreset]);

  const handlePresetSelect = async (presetId: string) => {
    setActivePreset(presetId);
    setLoading(true);
    try {
      const r = await runPreset(presetId, 25);
      setResults(r);
    } catch (e) {
      console.error(e);
      setResults([]);
    }
    setLoading(false);
  };

  const handleSort = (key: string) => {
    if (key === sortBy) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const clearFilters = () => {
    setFilters({});
    setActivePreset(null);
    setResults([]);
  };

  const saveCurrentScreen = () => {
    const name = window.prompt('Name this screen:');
    if (!name) return;
    const newScreens = [
      ...savedScreens,
      { name, filters: activePreset ? {} : filters },
    ];
    setSavedScreens(newScreens);
    localStorage.setItem('maet_saved_screens', JSON.stringify(newScreens));
  };

  const deleteScreen = (idx: number) => {
    const newScreens = savedScreens.filter((_, i) => i !== idx);
    setSavedScreens(newScreens);
    localStorage.setItem('maet_saved_screens', JSON.stringify(newScreens));
  };

  const loadScreen = (screen: SavedScreen) => {
    setFilters(screen.filters);
    setActivePreset(null);
  };

  return (
    <main
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundColor: 'var(--bg-0)', color: 'var(--text-0)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div
              className="text-[11px] mono tracking-wider uppercase mb-1"
              style={{ color: 'var(--gold)' }}
            >
              Filter · Discover · Trade
            </div>
            <h1 className="text-2xl font-display font-semibold">
              Stock Screener
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: 'var(--text-1)' }}
            >
              Find stocks that match your criteria. 200+ stocks · 20+ filters.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveCurrentScreen}
              disabled={Object.keys(filters).length === 0}
              className="flex items-center gap-1 px-3 py-2 border rounded text-xs hover:border-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-1)',
              }}
            >
              <Save size={12} /> Save
            </button>
          </div>
        </div>

        {savedScreens.length > 0 && (
          <div
            className="mb-4 border rounded p-3"
            style={{
              backgroundColor: 'var(--bg-1)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen
                size={12}
                style={{ color: 'var(--gold)' }}
              />
              <div
                className="text-[10px] mono uppercase tracking-wider"
                style={{ color: 'var(--text-2)' }}
              >
                Your Saved Screens
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {savedScreens.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 border rounded"
                  style={{
                    backgroundColor: 'var(--bg-2)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <button
                    onClick={() => loadScreen(s)}
                    className="px-3 py-1 text-xs hover:text-[var(--text-0)]"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => deleteScreen(i)}
                    className="px-2 hover:text-[var(--red)]"
                    style={{ color: 'var(--text-2)' }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <PresetGrid
          onSelect={handlePresetSelect}
          activePreset={activePreset}
        />

        <div className="flex gap-4 flex-wrap lg:flex-nowrap">
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
          />
          <div className="flex-1 min-w-0">
            <ScreenerTable
              stocks={results}
              loading={loading}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
