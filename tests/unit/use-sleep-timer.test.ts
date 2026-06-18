// useSleepTimer tests. The hook owns:
//   - endsAt + minutes state, persisted to localStorage
//   - a 1Hz interval that flips `isAsleep = true` when endsAt hits
//   - start/cancel/wake callbacks
// We use vitest fake timers to drive the interval without waiting
// wall-clock seconds. RTL renderHook gives us a real component
// context so useEffect/useState behave like in production.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSleepTimer } from '../../src/widgets/use-sleep-timer';

// playChime creates an AudioContext on first call. Stub it out so
// the hook doesn't try to wire up real audio in jsdom.
vi.mock('../../src/widgets/audio', () => ({
  playChime: vi.fn(),
  unlockAudio: vi.fn(),
}));

describe('useSleepTimer', () => {
  beforeEach(() => {
    // jsdom starts at epoch 0; pin a fixed time so duration math
    // is deterministic. 2026-06-18T10:00:00Z.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts inactive with no remaining time', () => {
    const { result } = renderHook(() => useSleepTimer());
    expect(result.current.isAsleep).toBe(false);
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.active).toBe(false);
  });

  it('transitions to active after start()', () => {
    const { result } = renderHook(() => useSleepTimer());
    act(() => result.current.start(30));
    expect(result.current.active).toBe(true);
    expect(result.current.isAsleep).toBe(false);
    // remainingMs should be ~30 minutes (in ms)
    const thirtyMin = 30 * 60_000;
    expect(result.current.remainingMs).toBeGreaterThan(thirtyMin - 5000);
    expect(result.current.remainingMs).toBeLessThanOrEqual(thirtyMin);
  });

  it('ignores start() with non-positive minutes', () => {
    const { result } = renderHook(() => useSleepTimer());
    act(() => result.current.start(0));
    expect(result.current.active).toBe(false);
    act(() => result.current.start(-5));
    expect(result.current.active).toBe(false);
  });

  it('flips isAsleep to true when endsAt is reached', () => {
    const { result } = renderHook(() => useSleepTimer());
    act(() => result.current.start(1)); // 1 minute
    expect(result.current.isAsleep).toBe(false);
    // Advance 60s + a tick so the interval fires and sees Date.now() >= endsAt.
    act(() => {
      vi.setSystemTime(new Date('2026-06-18T10:01:00Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isAsleep).toBe(true);
    expect(result.current.active).toBe(false);
  });

  it('cancel() clears the timer and keeps awake', () => {
    const { result } = renderHook(() => useSleepTimer());
    act(() => result.current.start(30));
    expect(result.current.active).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.active).toBe(false);
    expect(result.current.isAsleep).toBe(false);
  });

  it('wake() resets after going to sleep', () => {
    const { result } = renderHook(() => useSleepTimer());
    act(() => result.current.start(1));
    act(() => {
      vi.setSystemTime(new Date('2026-06-18T10:01:00Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isAsleep).toBe(true);
    act(() => result.current.wake());
    expect(result.current.isAsleep).toBe(false);
  });

  it('persists endsAt to localStorage so a reload resumes the timer', () => {
    const { result } = renderHook(() => useSleepTimer());
    act(() => result.current.start(45));
    const raw = window.localStorage.getItem('screensaver.sleep.v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.minutes).toBe(45);
    expect(typeof parsed.endsAt).toBe('number');
    expect(parsed.endsAt).toBeGreaterThan(Date.now());
  });

  it('reads existing localStorage on mount', () => {
    // Seed a future endsAt + minutes so the hook should pick it up.
    const endsAt = Date.now() + 30 * 60_000;
    window.localStorage.setItem(
      'screensaver.sleep.v1',
      JSON.stringify({ endsAt, minutes: 30 }),
    );
    const { result } = renderHook(() => useSleepTimer());
    expect(result.current.active).toBe(true);
    expect(result.current.remainingMs).toBeGreaterThan(0);
  });

  it('resumes asleep state when re-mounting after endsAt already passed', async () => {
    // Seed a stale endsAt (in the past).
    const past = Date.now() - 60_000;
    window.localStorage.setItem(
      'screensaver.sleep.v1',
      JSON.stringify({ endsAt: past, minutes: 30 }),
    );
    // Wrap render + microtask flush in act() so the async effect
    // commits before we read the result.
    let result!: ReturnType<typeof renderHook>['result'];
    await act(async () => {
      const r = renderHook(() => useSleepTimer());
      result = r.result;
      // Drain microtasks so the queueMicrotask setIsAsleep(true)
      // call from the initial-effect runs.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.isAsleep).toBe(true);
  });

  it('handles malformed localStorage gracefully', () => {
    window.localStorage.setItem('screensaver.sleep.v1', '{not json');
    const { result } = renderHook(() => useSleepTimer());
    // Falls back to the initial default: no active timer.
    expect(result.current.active).toBe(false);
    expect(result.current.remainingMs).toBe(0);
  });
});
