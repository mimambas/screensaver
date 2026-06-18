// useWorldCities tests. The hook owns:
//   - reading the persisted city list on mount (with v1→v2 shape migration)
//   - writing on change + dispatching the in-process 'worldcities:update'
//     event so other hook instances in the same tab reload
//   - listening to the cross-tab 'storage' event for siblings
//
// The cross-instance sync is the most interesting part — it
// re-renders the WorldClock widget the moment a user removes a
// city in the CitiesManager panel, without waiting for a reload.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorldCities, STORAGE_KEY } from '../../src/widgets/use-world-cities';
import { DEFAULT_CITIES } from '../../src/widgets/clock-constants';

describe('useWorldCities', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns DEFAULT_CITIES on first mount with no storage', () => {
    const { result } = renderHook(() => useWorldCities());
    expect(result.current).toEqual(DEFAULT_CITIES);
  });

  it('persists the city list to localStorage', () => {
    const { result } = renderHook(() => useWorldCities());
    expect(result.current).toEqual(DEFAULT_CITIES);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(DEFAULT_CITIES);
  });

  it('loads a previously-saved city list', () => {
    const saved = [
      { name: 'SFO', tz: 'America/Los_Angeles' },
      { name: 'TYO', tz: 'Asia/Tokyo' },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const { result } = renderHook(() => useWorldCities());
    expect(result.current).toEqual(saved);
  });

  it('migrates v1 (tz-only) entries to v2 ({name, tz}) on read', () => {
    // Pre-v2 the array was just IANA timezone strings; we tagged
    // each one with a generated name from the last segment.
    const v1 = ['America/Los_Angeles', 'Asia/Tokyo'];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v1));
    const { result } = renderHook(() => useWorldCities());
    expect(result.current).toEqual([
      { name: 'Los Angeles', tz: 'America/Los_Angeles' },
      { name: 'Tokyo', tz: 'Asia/Tokyo' },
    ]);
  });

  it('replaces underscores with spaces in the generated name', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['America/New_York']));
    const { result } = renderHook(() => useWorldCities());
    expect(result.current[0]).toEqual({ name: 'New York', tz: 'America/New_York' });
  });

  it('falls back to defaults on malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useWorldCities());
    expect(result.current).toEqual(DEFAULT_CITIES);
  });

  it('falls back to defaults when the array is empty', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    const { result } = renderHook(() => useWorldCities());
    expect(result.current).toEqual(DEFAULT_CITIES);
  });

  it('filters out entries with a non-string tz', () => {
    const polluted = [
      { name: 'OK', tz: 'Asia/Tokyo' },
      { name: 'BAD', tz: 42 },
      { name: 'NULLED', tz: null },
      { tz: '' },
      null,
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(polluted));
    const { result } = renderHook(() => useWorldCities());
    expect(result.current).toEqual([{ name: 'OK', tz: 'Asia/Tokyo' }]);
  });

  it('dispatches worldcities:update after every change', () => {
    const onUpdate = vi.fn();
    window.addEventListener('worldcities:update', onUpdate);
    // The hook reads on mount and the useEffect fires once with
    // the loaded array — that already triggers saveCities →
    // dispatchEvent. So we just need to mount it.
    renderHook(() => useWorldCities());
    expect(onUpdate).toHaveBeenCalled();
    window.removeEventListener('worldcities:update', onUpdate);
  });

  it('cross-tab: storage event from another tab reloads the list', () => {
    // Listen for the reload path. We don't fire a real 'storage'
    // event because jsdom's StorageEvent handling is brittle in
    // a single-tab test runner (and has caused OOMs in earlier
    // iterations). Instead we call the listener path indirectly
    // by mutating localStorage and re-reading via a fresh hook.
    // The hook is unit-tested at the data layer too — this is
    // the integration smoke that the wiring exists.
    const { result } = renderHook(() => useWorldCities());
    const initial = result.current;
    expect(initial).toEqual(DEFAULT_CITIES);
    // We verify the listener by simulating the same code path the
    // browser would invoke: another tab calls localStorage.setItem
    // and the browser fires 'storage'. We exercise the path
    // through a manual dispatch wrapped in act() so React commits.
    const newCities = [{ name: 'MEX', tz: 'America/Mexico_City' }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newCities));
    act(() => {
      const ev = new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify(newCities),
      });
      window.dispatchEvent(ev);
    });
    expect(result.current).toEqual(newCities);
  });

  it('ignores storage events for other keys', () => {
    const { result } = renderHook(() => useWorldCities());
    const initial = result.current;
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'some.other.key', newValue: 'x' }),
      );
    });
    expect(result.current).toBe(initial);
  });
});
