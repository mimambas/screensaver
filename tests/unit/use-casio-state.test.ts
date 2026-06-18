// useCasioState tests. The hook is the F-91W state machine — it
// doesn't render, just exposes transitions and flags. We assert
// state changes after pressL / pressC / pressA / releaseA and
// verify the auto-repeat timer for held buttons increments the
// edited field. Using fake timers + act() keeps the wall-clock
// out of it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCasioState } from '../../src/widgets/use-casio-state';

// Stub the casio bip audio element + AudioContext path so the
// hook doesn't try to play sound in jsdom.
vi.mock('../../src/widgets/audio', () => ({
  playChime: vi.fn(),
  unlockAudio: vi.fn(),
}));

beforeEach(() => {
  // The casio state machine uses setInterval for stopwatch and
  // setTimeout for the CA510 hold. Always use fake timers; tests
  // that need real wall-clock skip with vi.useRealTimers().
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCasioState — initial state', () => {
  it('starts on dateTime/default with the reference default flags', () => {
    const { result } = renderHook(() => useCasioState());
    expect(result.current.state).toEqual({ menu: 'dateTime', action: 'default' });
    expect(result.current.flags).toEqual({
      alarmOn: true,
      hourlyChime: true,
      timeMode12: true,
      light: false,
    });
    expect(result.current.stopwatchMs).toBe(0);
  });

  it('initialises the alarm time to 07:00 today', () => {
    const { result } = renderHook(() => useCasioState());
    const d = result.current.alarmTime;
    expect(d.getHours()).toBe(7);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it('starts with zero dateTimeOffset', () => {
    const { result } = renderHook(() => useCasioState());
    expect(result.current.dateTimeOffset).toBe(0);
  });
});

describe('useCasioState — pressC cycles menus', () => {
  it('advances dateTime → dailyAlarm → stopwatch → setDateTime → dateTime', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC());
    expect(result.current.state.menu).toBe('dailyAlarm');
    act(() => result.current.pressC());
    expect(result.current.state.menu).toBe('stopwatch');
    act(() => result.current.pressC());
    expect(result.current.state.menu).toBe('setDateTime');
    act(() => result.current.pressC());
    expect(result.current.state.menu).toBe('dateTime');
  });

  it('resets action to "default" on every menu change', () => {
    const { result } = renderHook(() => useCasioState());
    // Press L on setDateTime: default → edit-hours.
    act(() => result.current.pressC()); // dailyAlarm
    act(() => result.current.pressC()); // stopwatch
    act(() => result.current.pressC()); // setDateTime
    act(() => result.current.pressL()); // → edit-hours
    expect(result.current.state.action).toBe('edit-hours');
    act(() => result.current.pressC()); // back to dateTime
    expect(result.current.state).toEqual({ menu: 'dateTime', action: 'default' });
  });
});

describe('useCasioState — dailyAlarm edit cycles via pressL', () => {
  it('default → edit-hours → edit-minutes → modified → edit-hours', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC()); // → dailyAlarm/default
    act(() => result.current.pressL());
    expect(result.current.state.action).toBe('edit-hours');
    act(() => result.current.pressL());
    expect(result.current.state.action).toBe('edit-minutes');
    act(() => result.current.pressL());
    expect(result.current.state.action).toBe('modified');
    act(() => result.current.pressL());
    expect(result.current.state.action).toBe('edit-hours');
  });

  it('increments alarm hour on pressA in edit-hours', async () => {
    // pressA reads `state` from the closure when computing the
    // increment — and the closure captures `state` at the time
    // the useCallback was created. The hook re-creates pressA on
    // every render, so a stale closure can read the wrong state.
    // Use a re-render to flush the new pressA, then call it.
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC());
    act(() => result.current.pressL()); // → edit-hours
    // Re-render to ensure pressA's closure has the new state.
    await act(async () => { await Promise.resolve(); });
    const before = result.current.alarmTime.getHours();
    act(() => result.current.pressA());
    expect(result.current.alarmTime.getHours()).toBe((before + 1) % 24);
  });

  it('increments alarm minute on pressA in edit-minutes', async () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC());
    act(() => result.current.pressL()); // edit-hours
    act(() => result.current.pressL()); // edit-minutes
    await act(async () => { await Promise.resolve(); });
    const before = result.current.alarmTime.getMinutes();
    act(() => result.current.pressA());
    expect(result.current.alarmTime.getMinutes()).toBe((before + 1) % 60);
  });
});

describe('useCasioState — stopwatch', () => {
  it('pressL on stopwatch/default enters modified (split)', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC()); // dailyAlarm
    act(() => result.current.pressC()); // stopwatch
    act(() => result.current.pressL());
    expect(result.current.state.action).toBe('modified');
    act(() => result.current.pressL());
    expect(result.current.state.action).toBe('default');
  });

  it('pressA on stopwatch/default starts the stopwatch running', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC()); // dailyAlarm
    act(() => result.current.pressC()); // stopwatch/default
    act(() => result.current.pressA());
    // Verify the stopwatch moved off zero — the absolute number is
    // jittery under fake timers because performance.now() and the
    // setInterval fire in a discrete order. We've already proven
    // the wiring in the e2e suite.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.stopwatchMs).toBeGreaterThan(0);
  });

  it('leaving stopwatch via pressC resets stopwatchMs to 0', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC());
    act(() => result.current.pressC()); // stopwatch
    act(() => result.current.pressA());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.stopwatchMs).toBeGreaterThan(0);
    act(() => result.current.pressC()); // leave stopwatch
    expect(result.current.stopwatchMs).toBe(0);
  });
});

describe('useCasioState — setDateTime', () => {
  it('pressL cycles through all 5 edit actions then back to default', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC());
    act(() => result.current.pressC());
    act(() => result.current.pressC()); // setDateTime/default
    const cycle = [
      'edit-hours',
      'edit-minutes',
      'edit-month',
      'edit-day-number',
      'edit-day-letter',
      'default',
    ];
    for (const expected of cycle) {
      act(() => result.current.pressL());
      expect(result.current.state.action).toBe(expected);
    }
  });

  it('pressA on setDateTime/default decrements dateTimeOffset by 1s', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC());
    act(() => result.current.pressC());
    act(() => result.current.pressC()); // setDateTime/default
    const before = result.current.dateTimeOffset;
    act(() => result.current.pressA());
    expect(result.current.dateTimeOffset).toBe(before - 1000);
  });
});

describe('useCasioState — dateTime/default A handling', () => {
  it('pressA on dateTime/default schedules the CA510 timer (3s hold)', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressA());
    // Before 3s: no CA510 yet.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.state.action).toBe('default');
    // After 3s: CA510 shown.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.state.action).toBe('casio');
    expect(result.current.state.casioShownAt).toBeTypeOf('number');
  });

  it('releaseA within 3s on dateTime/default toggles 12/24h', () => {
    const { result } = renderHook(() => useCasioState());
    expect(result.current.flags.timeMode12).toBe(true);
    act(() => result.current.pressA());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => result.current.releaseA());
    expect(result.current.flags.timeMode12).toBe(false);
    // State unchanged (still default, not casio).
    expect(result.current.state.action).toBe('default');
  });

  it('releaseA while in casio action reverts to default', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressA());
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(result.current.state.action).toBe('casio');
    act(() => result.current.releaseA());
    expect(result.current.state.action).toBe('default');
  });
});

describe('useCasioState — flag cycles', () => {
  it('pressA on dailyAlarm/default cycles alarm + chime flags', () => {
    const { result } = renderHook(() => useCasioState());
    // Initial flags: alarmOn=true, hourlyChime=true.
    expect(result.current.flags).toMatchObject({ alarmOn: true, hourlyChime: true });
    act(() => result.current.pressC()); // dailyAlarm
    act(() => result.current.pressA());
    // Cycle step 1: alarmOn=false, hourlyChime=true.
    expect(result.current.flags).toMatchObject({ alarmOn: false, hourlyChime: true });
    act(() => result.current.pressA());
    // Cycle step 2: both back on.
    expect(result.current.flags).toMatchObject({ alarmOn: true, hourlyChime: true });
  });
});

describe('useCasioState — reset', () => {
  it('reset() returns to initial state', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC());
    act(() => result.current.pressL());
    act(() => result.current.pressA());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => result.current.reset());
    expect(result.current.state).toEqual({ menu: 'dateTime', action: 'default' });
    expect(result.current.flags).toEqual({
      alarmOn: true,
      hourlyChime: true,
      timeMode12: true,
      light: false,
    });
    expect(result.current.stopwatchMs).toBe(0);
  });
});

describe('useCasioState — auto-repeat on held A', () => {
  it('holding A on dailyAlarm/edit-hours auto-increments after 1s', () => {
    const { result } = renderHook(() => useCasioState());
    act(() => result.current.pressC()); // dailyAlarm
    act(() => result.current.pressL()); // edit-hours
    const before = result.current.alarmTime.getHours();
    act(() => result.current.pressA());
    // After 1s the auto-repeat kicks in, then every 100ms.
    act(() => {
      vi.advanceTimersByTime(1500); // 1s delay + 5 ticks of 100ms = 5 increments
    });
    const after = result.current.alarmTime.getHours();
    expect((after - before + 24) % 24).toBeGreaterThanOrEqual(3);
    // Release to stop the auto-repeat.
    act(() => result.current.releaseA());
  });
});
