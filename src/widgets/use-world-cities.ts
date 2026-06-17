// useWorldCities: shared state hook for the WorldClock city list.
// Lives in its own file so the CitiesManager component file can
// stay "only exports components" for react-refresh fast refresh.
//
// Reads from localStorage on mount, writes on change, and listens
// to the 'storage' event so multiple tabs / hook instances stay in
// sync (CitiesManager + WorldClock widget). App.tsx uses this to
// feed <WorldClock cities={...}>.

import { useEffect, useState } from 'react';
import { DEFAULT_CITIES } from './clock-constants';

// WorldCity shape — duplicated here to avoid a circular import
// (WorldClockCities.tsx imports from this file).
export type WorldCity = { name: string; tz: string };

const STORAGE_KEY = 'screensaver.worldclock.cities.v1';

function loadCities(): WorldCity[] {
  if (typeof window === 'undefined') return DEFAULT_CITIES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CITIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CITIES;
    return parsed
      .filter(
        (c): c is WorldCity | { tz: string } =>
          c != null && typeof c.tz === 'string' && c.tz.length > 0,
      )
      .map((c) => {
        // Migrate the v1 shape (only `tz`) to v2 ({ name, tz }).
        if (typeof (c as WorldCity).name === 'string' && (c as WorldCity).name.length > 0) {
          return c as WorldCity;
        }
        const tzOnly = (c as { tz: string }).tz;
        const parts = tzOnly.split('/');
        return { name: parts[parts.length - 1].replace(/_/g, ' '), tz: tzOnly };
      });
  } catch {
    return DEFAULT_CITIES;
  }
}

function saveCities(cities: WorldCity[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
    // Notify sibling hook instances in the same tab. The native
    // 'storage' event only fires across tabs, not within one.
    window.dispatchEvent(new Event('worldcities:update'));
  } catch {
    // ignore
  }
}

export function useWorldCities(): WorldCity[] {
  const [cities, setCities] = useState<WorldCity[]>(loadCities);
  // Persist changes to localStorage AND fire the in-process sync
  // event so any other CitiesManager / WorldClock hook instance in
  // the same tab reloads from disk. Without the dispatch, removing
  // a city from CitiesManager wouldn't show up in the WorldClock
  // widget until the next full page load.
  useEffect(() => {
    saveCities(cities);
    window.dispatchEvent(new Event('worldcities:update'));
  }, [cities]);
  // Cross-instance sync: if another component (or tab) updates
  // storage, reload. Cheap because the saved array is small.
  // We listen on both 'storage' (cross-tab) and a custom
  // 'worldcities:update' event (in-process sibling hook instances
  // — within the same tab the browser does NOT fire 'storage' for
  // its own writes, so we ship our own signal).
  useEffect(() => {
    const reload = () => setCities(loadCities());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) reload();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('worldcities:update', reload);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('worldcities:update', reload);
    };
  }, []);
  return cities;
}

// Re-exported so the CitiesManager component can call save directly
// without re-implementing the storage key constant.
export { STORAGE_KEY, loadCities, saveCities };
