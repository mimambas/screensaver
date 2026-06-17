// Custom city list for WorldClock. CitiesManager is the only public
// surface — App.tsx imports the default cities from clock-constants
// directly, so we don't need to expose city state up the tree.

import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { DEFAULT_CITIES } from './clock-constants';
import type { ThemeName } from './clock-constants';
import { loadCities, saveCities } from './use-world-cities';
import type { WorldCity } from './use-world-cities';
import { useT } from '../i18n';

// re-export for backward-compat with any existing imports
export type { WorldCity } from './use-world-cities';

// Derive a human-readable label from an IANA tz string. We use the
// last '/' segment, but keep the full tz as the authoritative key
// so two cities with the same prefix (e.g. America/Indiana/...)
// stay distinct.
function labelFromTz(tz: string): string {
  const parts = tz.split('/');
  return parts[parts.length - 1].replace(/_/g, ' ');
}

export function CitiesManager({ theme = 'dark' }: { theme?: ThemeName }) {
  const t = useT();
  const [cities, setCities] = useState<WorldCity[]>(loadCities);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    saveCities(cities);
  }, [cities]);

  const add = useCallback((tz: string) => {
    const trimmed = tz.trim();
    if (!trimmed) return;
    setCities((cur) => [...cur, { name: labelFromTz(trimmed), tz: trimmed }]);
    setDraft('');
  }, []);

  const rename = useCallback((idx: number, name: string) => {
    setCities((cur) => cur.map((c, i) => (i === idx ? { ...c, name } : c)));
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
          placeholder={t('cities.addPlaceholder')}
          className={`flex-1 px-2 py-1 rounded text-[10px] outline-none ${inputClass} ${rowClass}`}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          aria-label={t('cities.addAria')}
          className={`p-1 rounded transition-colors ${
            !draft.trim() ? 'opacity-30 cursor-not-allowed' : rowClass
          }`}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      <div className={`text-[10px] ${hintClass}`}>
        {t('settings.cities.hint')}
        <span className="font-mono">Asia/Singapore</span>) — display name auto-derived.
      </div>
      <ul className="space-y-0.5" data-cities-list>
        {cities.map((c, i) => (
          <li
            key={`${c.tz}-${i}`}
            data-city-tz={c.tz}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ${rowClass}`}
          >
            <input
              type="text"
              value={c.name}
              onChange={(e) => rename(i, e.target.value)}
              aria-label={t('cities.renameAria', { tz: c.tz })}
              className={`flex-1 min-w-0 px-1 py-0.5 rounded text-[10px] outline-none ${inputClass}`}
            />
            <span className={`text-[9px] font-mono opacity-50 ${hintClass}`} title={c.tz}>
              {c.tz.split('/').slice(-2).join('/')}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t('cities.removeAria', { tz: c.tz })}
              data-remove-city={c.tz}
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
          {t('settings.cities.reset')}
        </button>
      )}
    </div>
  );
}
