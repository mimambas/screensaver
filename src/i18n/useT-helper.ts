// useT hook: resolves a catalog key to the active locale's string.
// Lives in a .ts (not .tsx) sibling file so the I18nProvider
// component file can keep "only exports components" semantics for
// react-refresh fast refresh.

import { useContext } from 'react';
import { catalog, type Locale } from './catalog';
import type { TFunction } from './useT';
import { I18nContext } from './useT';

export function useT(): TFunction {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Outside provider: return English-only fallback so tests /
    // SSR / previews still work. In practice the provider wraps
    // the whole app, so this branch is only hit in tests that
    // forget.
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
