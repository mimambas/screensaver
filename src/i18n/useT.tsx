// i18n provider + useT hook.
//
// Pattern matches the other small shared hooks in this codebase
// (useSleepTimer, useWorldCities): localStorage-backed state, a
// small React Context, and a single named export. App.tsx wraps
// its children in <I18nProvider>; consumer widgets call useT() to
// resolve a key to the current locale's string.
//
// We store the active locale under 'screensaver.lang'. On first
// load (no entry) we fall back to navigator.language — `id*` →
// 'id', else 'en'. This way Indonesian users get Indonesian
// automatically the first time they open the app.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { catalog, type Locale } from './catalog';

const STORAGE_KEY = 'screensaver.lang';

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'id') return stored;
  } catch {
    // localStorage may be unavailable; fall through
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  return nav.toLowerCase().startsWith('id') ? 'id' : 'en';
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  // Persist on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const t = useCallback<TFunction>(
    (key, params) => {
      const entry = catalog[key];
      // Fallback chain: requested locale → English → the raw key
      // (so a missing entry is visible during dev, not silent).
      const raw = (entry && entry[locale]) || (entry && entry.en) || key;
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (_m, name) => {
        const v = params[name];
        return v == null ? `{${name}}` : String(v);
      });
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): TFunction {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Outside provider: return English-only fallback so tests / SSR
    // / previews still work. In practice the provider wraps the
    // whole app, so this branch is only hit in tests that forget.
    return (key, params) => {
      const entry = catalog[key];
      const raw = (entry && entry.en) || key;
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (_m, name) => {
        const v = params[name];
        return v == null ? `{${name}}` : String(v);
      });
    };
  }
  return ctx.t;
}

export function useLocale(): [Locale, (l: Locale) => void] {
  const ctx = useContext(I18nContext);
  if (!ctx) return ['en', () => {}];
  return [ctx.locale, ctx.setLocale];
}
