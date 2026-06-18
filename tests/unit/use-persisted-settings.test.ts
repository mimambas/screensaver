// usePersistedSettings tests. The hook owns 25 useState calls
// + clamp logic + v1→v2 migration + debounced localStorage
// writes. The tests focus on the migration + persistence layer
// (the most regression-prone parts) plus the bulk actions
// (turnOffAll, resetToDefaults).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedSettings } from '../../src/widgets/use-persisted-settings';

const STORAGE_KEY = 'screensaver.settings.v2';
const STORAGE_KEY_V1 = 'screensaver.settings.v1';

describe('usePersistedSettings — initial load', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns defaults when localStorage is empty', () => {
    const { result } = renderHook(() => usePersistedSettings());
    expect(result.current.state.layout).toBe('classic');
    expect(result.current.state.theme).toBe('dark');
    expect(result.current.state.ambient).toBe('none');
    expect(result.current.state.wallpaper).toBe('aurora');
    expect(result.current.state.clockStyle).toBe('digital');
    expect(result.current.state.showDate).toBe(true);
    expect(result.current.state.showCalendar).toBe(false);
    expect(result.current.state.showDayProgress).toBe(true);
    expect(result.current.state.showAlarms).toBe(true);
  });

  it('reads a v2 record from localStorage on mount', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ layout: 'split', theme: 'forest', ambient: 'rain' }),
    );
    const { result } = renderHook(() => usePersistedSettings());
    expect(result.current.state.layout).toBe('split');
    expect(result.current.state.theme).toBe('forest');
    expect(result.current.state.ambient).toBe('rain');
  });

  it('falls back to v1 if v2 is missing', () => {
    window.localStorage.setItem(
      STORAGE_KEY_V1,
      JSON.stringify({ theme: 'sunset' }),
    );
    const { result } = renderHook(() => usePersistedSettings());
    expect(result.current.state.theme).toBe('sunset');
  });

  it('falls back to defaults on malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => usePersistedSettings());
    expect(result.current.state.theme).toBe('dark');
  });

  it('merges partial v2 over defaults (every missing field uses the default)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: 'claude' }),
    );
    const { result } = renderHook(() => usePersistedSettings());
    expect(result.current.state.theme).toBe('claude');
    // Layout wasn't in the saved record → default.
    expect(result.current.state.layout).toBe('classic');
  });
});

describe('usePersistedSettings — setters persist', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // The hook debounces writes by 250ms. Use fake timers to
    // avoid wall-clock waiting.
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('setLayout updates state and persists to localStorage', () => {
    const { result } = renderHook(() => usePersistedSettings());
    act(() => result.current.set.setLayout('minimal'));
    expect(result.current.state.layout).toBe('minimal');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.layout).toBe('minimal');
  });

  it('setTheme persists', () => {
    const { result } = renderHook(() => usePersistedSettings());
    act(() => result.current.set.setTheme('ocean'));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(parsed.theme).toBe('ocean');
  });

  it('setAmbient accepts the new soundscape ids', () => {
    const { result } = renderHook(() => usePersistedSettings());
    act(() => result.current.set.setAmbient('fireplace'));
    expect(result.current.state.ambient).toBe('fireplace');
    act(() => result.current.set.setAmbient('ocean'));
    expect(result.current.state.ambient).toBe('ocean');
    act(() => result.current.set.setAmbient('night'));
    expect(result.current.state.ambient).toBe('night');
  });

  it('setClockSize clamps out-of-range values', () => {
    const { result } = renderHook(() => usePersistedSettings());
    act(() => result.current.set.setClockSize(99));
    // CLOCK_SIZE_PRESETS.max = 3.0
    expect(result.current.state.clockSize).toBe(3.0);
    act(() => result.current.set.setClockSize(0.01));
    expect(result.current.state.clockSize).toBe(0.5);
  });

  it('adjustClockSize is a relative setter clamped', () => {
    const { result } = renderHook(() => usePersistedSettings());
    act(() => result.current.set.setClockSize(2.8));
    act(() => result.current.set.adjustClockSize(1));
    expect(result.current.state.clockSize).toBe(3.0);
    act(() => result.current.set.adjustClockSize(-100));
    expect(result.current.state.clockSize).toBe(0.5);
  });
});

describe('usePersistedSettings — bulk actions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('turnOffAll disables every widget', () => {
    const { result } = renderHook(() => usePersistedSettings());
    act(() => result.current.set.turnOffAll());
    expect(result.current.state.showDate).toBe(false);
    expect(result.current.state.showCalendar).toBe(false);
    expect(result.current.state.showWorldClock).toBe(false);
    expect(result.current.state.showQuote).toBe(false);
    expect(result.current.state.showWeather).toBe(false);
    expect(result.current.state.showStopwatch).toBe(false);
    expect(result.current.state.showPomodoro).toBe(false);
    expect(result.current.state.showDayProgress).toBe(false);
    expect(result.current.state.showAlarms).toBe(false);
    expect(result.current.state.showTimer).toBe(false);
    expect(result.current.state.showBreathing).toBe(false);
    expect(result.current.state.showAffirmation).toBe(false);
  });

  it('resetToDefaults returns every field to the default', () => {
    const { result } = renderHook(() => usePersistedSettings());
    act(() => {
      result.current.set.setTheme('forest');
      result.current.set.setLayout('minimal');
      result.current.set.setAmbient('rain');
      result.current.set.setClockStyle('casio');
    });
    expect(result.current.state.theme).toBe('forest');
    act(() => result.current.set.resetToDefaults());
    expect(result.current.state.theme).toBe('dark');
    expect(result.current.state.layout).toBe('classic');
    expect(result.current.state.ambient).toBe('none');
    expect(result.current.state.clockStyle).toBe('digital');
  });
});

describe('usePersistedSettings — debounce', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('persists the latest snapshot to localStorage', () => {
    const { result } = renderHook(() => usePersistedSettings());
    act(() => {
      result.current.set.setLayout('split');
      result.current.set.setTheme('forest');
      result.current.set.setAmbient('rain');
    });
    // vi.advanceTimersByTime(300) should trigger the 250ms debounce.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.layout).toBe('split');
    expect(parsed.theme).toBe('forest');
    expect(parsed.ambient).toBe('rain');
  });
});
