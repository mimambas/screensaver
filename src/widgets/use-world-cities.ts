// useWorldCities: shared state hook for the WorldClock city list.
// Lives in its own file so the CitiesManager component file can
// stay "only exports components" for react-refresh fast refresh.
//
// Reads from localStorage on mount, writes on change, and listens
// to the 'storage' event so multiple tabs / hook instances stay in
// sync (CitiesManager + WorldClock widget). App.tsx uses this to
// feed <WorldClock cities={...}>.

import { useEffect, useRef, useState } from 'react';
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
      .map((c): WorldCity | null => {
        // v1 shape: bare IANA timezone string.
        if (typeof c === 'string' && c.length > 0) {
          const parts = c.split('/');
          return { name: parts[parts.length - 1].replace(/_/g, ' '), tz: c };
        }
        if (c == null || typeof c !== 'object') return null;
        const obj = c as Partial<WorldCity>;
        // v2 shape: { name, tz }.
        if (typeof obj.tz === 'string' && obj.tz.length > 0 &&
            typeof obj.name === 'string' && obj.name.length > 0) {
          return { name: obj.name, tz: obj.tz };
        }
        // v1-like: { tz } only, no name.
        if (typeof obj.tz === 'string' && obj.tz.length > 0) {
          const parts = obj.tz.split('/');
          return { name: parts[parts.length - 1].replace(/_/g, ' '), tz: obj.tz };
        }
        return null;
      })
      .filter((c): c is WorldCity => c !== null);
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
  //
  // The save effect skips the dispatch on the very first run. The
  // mount also reads loadCities(); if we fired the update event
  // here, every freshly-mounted hook would re-save and the
  // listener on the same hook would re-read it — an infinite
  // chain in jsdom / a tight CPU loop in production. We tag the
  // skip in a ref instead of comparing arrays (cheaper and
  // immune to false equality from object identity).
  const skipNextSaveRef = useRef(false);
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveCities(cities);
  }, [cities]);
  // Cross-instance sync: if another component (or tab) updates
  // storage, reload. Cheap because the saved array is small.
  // We listen on both 'storage' (cross-tab) and a custom
  // 'worldcities:update' event (in-process sibling hook instances
  // — within the same tab the browser does NOT fire 'storage' for
  // its own writes, so we ship our own signal).
  useEffect(() => {
    const reload = () => {
      // Skip the next save — we just reloaded from storage, the
      // JSON round-trip is a no-op so we don't need to write it
      // back, and the resulting dispatchEvent would trigger
      // another reload on ourselves.
      skipNextSaveRef.current = true;
      setCities(loadCities());
    };
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
