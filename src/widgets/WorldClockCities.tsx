// Custom city list for WorldClock. CitiesManager is the only public
// surface — App.tsx imports the default cities from clock-constants
// directly, so we don't need to expose city state up the tree.

import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { DEFAULT_CITIES } from './clock-constants';
import type { ThemeName } from './clock-constants';

const STORAGE_KEY = 'screensaver.worldclock.cities.v1';

export type WorldCity = { name: string; tz: string };

function loadCities(): WorldCity[] {
  if (typeof window === 'undefined') return DEFAULT_CITIES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CITIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CITIES;
    return parsed.filter(
      (c): c is WorldCity =>
        c != null &&
        typeof c.name === 'string' &&
        typeof c.tz === 'string' &&
        c.name.length > 0 &&
        c.tz.length > 0,
    );
  } catch {
    return DEFAULT_CITIES;
  }
}

function saveCities(cities: WorldCity[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
  } catch {
    // ignore
  }
}

export function CitiesManager({ theme = 'dark' }: { theme?: ThemeName }) {
  const [cities, setCities] = useState<WorldCity[]>(loadCities);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    saveCities(cities);
  }, [cities]);

  const add = useCallback((tz: string) => {
    const trimmed = tz.trim();
    if (!trimmed) return;
    setCities((cur) => [...cur, { name: trimmed, tz: trimmed }]);
    setDraft('');
  }, []);

  const remove = useCallback((idx: number) => {
    setCities((cur) => cur.filter((_, i) => i !== idx));
  }, []);

  const reset = useCallback(() => {
    setCities(DEFAULT_CITIES);
  }, []);

  const isDark = theme === 'dark';
  const isClaude = theme === 'claude';
  const rowClass = isDark
    ? 'bg-white/5 hover:bg-white/10 text-white/80'
    : isClaude
    ? 'bg-[#e8dcc4]/40 hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
    : 'bg-black/5 hover:bg-black/10 text-black/80';
  const inputClass = isDark
    ? 'bg-transparent text-white placeholder-white/30'
    : isClaude
    ? 'bg-transparent text-[#3a2e1f] placeholder-[#3a2e1f]/40'
    : 'bg-transparent text-black placeholder-black/30';
  const hintClass = isDark ? 'text-white/40' : isClaude ? 'text-[#3a2e1f]/40' : 'text-black/40';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add(draft);
          }}
          placeholder="Add city (e.g. Asia/Singapore)"
          className={`flex-1 px-2 py-1 rounded text-[10px] outline-none ${inputClass} ${rowClass}`}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          aria-label="Add city"
          className={`p-1 rounded transition-colors ${
            !draft.trim() ? 'opacity-30 cursor-not-allowed' : rowClass
          }`}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      <div className={`text-[10px] ${hintClass}`}>
        Enter a timezone (IANA name) — used as both label and timezone.
      </div>
      <ul className="space-y-0.5">
        {cities.map((c, i) => (
          <li
            key={`${c.tz}-${i}`}
            className={`flex items-center justify-between px-2 py-1 rounded text-[10px] ${rowClass}`}
          >
            <span className="truncate">{c.tz}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove ${c.tz}`}
              className="p-0.5 opacity-50 hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </button>
          </li>
        ))}
      </ul>
      {cities.length > DEFAULT_CITIES.length && (
        <button
          type="button"
          onClick={reset}
          className={`w-full px-2 py-1 rounded text-[10px] transition-colors ${
            isDark
              ? 'bg-white/5 hover:bg-white/15 text-white/60'
              : isClaude
              ? 'bg-[#e8dcc4] hover:bg-[#d4b896] text-[#3a2e1f]/60'
              : 'bg-black/5 hover:bg-black/15 text-black/60'
          }`}
        >
          Reset to defaults
        </button>
      )}
    </div>
  );
}
