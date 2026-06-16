// F-91W state machine — direct port of dundalek/casio-f91w-fsm's
// machine.js (xstate). Top-level states: `dateTime`, `dailyAlarm`,
// `stopwatch`, `setDateTime`. Each menu has sub-states for the
// "action" being performed (default, edit-hours, etc.). Transitions
// fire on the watch buttons (L / C / A).
//
// Differences from the reference:
//   - We don't run on a statechart library; the state is just a
//     discriminated union in React state.
//   - Buttons are not real DOM buttons. We expose pressL / pressC /
//     pressA from the hook and let the parent wire them to keyboard
//     or pointer events.
//   - We don't model the alarm bips or 100th-second tick — for a
//     screensaver it's enough to render the right screen.
//
// State shape (discriminated union):
//   { menu: 'dateTime', action: 'default' | 'casio' }
//   { menu: 'dailyAlarm', action: 'default' | 'edit-hours' | 'edit-minutes' | 'modified' }
//   { menu: 'stopwatch', action: 'default' | 'modified' }
//   { menu: 'setDateTime', action: 'default' | 'edit-hours' | 'edit-minutes' | 'edit-month' | 'edit-day-number' | 'edit-day-letter' }

import { useCallback, useEffect, useRef, useState } from 'react';

export type CasioMenu = 'dateTime' | 'dailyAlarm' | 'stopwatch' | 'setDateTime';
export type CasioAction =
  | 'default'
  | 'casio' // dateTime only — CA510 easter egg
  | 'edit-hours'
  | 'edit-minutes'
  | 'edit-month'
  | 'edit-day-number'
  | 'edit-day-letter'
  | 'modified';

export type CasioState = {
  menu: CasioMenu;
  action: CasioAction;
  /** When action === 'casio', this is the timestamp the user started
   *  holding A. We auto-revert to 'default' after 2s. */
  casioShownAt?: number;
};

export type CasioFlags = {
  alarmOn: boolean;
  hourlyChime: boolean;
  timeMode12: boolean; // false = 24h
  light: boolean;
};

export type CasioHandle = {
  state: CasioState;
  flags: CasioFlags;
  pressL: () => void;
  pressC: () => void;
  pressA: () => void;
  releaseL: () => void;
  releaseC: () => void;
  releaseA: () => void;
  /** Stopwatch display, in ms, only meaningful when menu === 'stopwatch'. */
  stopwatchMs: number;
  /** Reset everything back to dateTime/default. */
  reset: () => void;
};

// Default initial state. Reference's _init sets:
//   - alarmOn: true
//   - hourlyChime: true
//   - timeMode: '12'
//   - light: false
const INITIAL: { state: CasioState; flags: CasioFlags } = {
  state: { menu: 'dateTime', action: 'default' },
  flags: {
    alarmOn: true,
    hourlyChime: true,
    timeMode12: true,
    light: false,
  },
};

export function useCasioState(): CasioHandle {
  const [state, setState] = useState<CasioState>(INITIAL.state);
  const [flags, setFlags] = useState<CasioFlags>(INITIAL.flags);
  // Stopwatch time. Reference increments with a real interval; we just
  // expose it for display. Callers can drive it from a setInterval.
  const [stopwatchMs, setStopwatchMs] = useState(0);

  // CA510 timer — if A is held for 3s on dateTime/default, show "CA510"
  // on the mode display. We start a 3s timer on a-down, cancel on a-up.
  const caTimer = useRef<number | null>(null);

  // Stopwatch driver — every 31ms (≈32fps) tick the stopwatch forward.
  // We subscribe to a state flag (`stopwatchRunning`) and toggle it from
  // the press/release handlers so the effect can re-run on state change.
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const stopwatchSplit = useRef<number | null>(null);
  const lastStopwatchTick = useRef<number | null>(null);

  useEffect(() => {
    if (!stopwatchRunning) return;
    lastStopwatchTick.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - (lastStopwatchTick.current ?? now);
      lastStopwatchTick.current = now;
      setStopwatchMs((m) => m + dt);
    }, 31);
    return () => window.clearInterval(id);
  }, [stopwatchRunning]);

  const pressL = useCallback(() => {
    // L is "mode/modify" — moves into edit state from default, or
    // advances to the next edit field. Reference transitions:
    //   dateTime:  L does nothing on time screen.
    //   dailyAlarm:  L on default → edit-hours; on edit-hours → edit-minutes;
    //                 on edit-minutes → modified; on modified → edit-hours.
    //   stopwatch:  L on default → modified (toggle split); on modified → default (release split).
    //   setDateTime: L on default → edit-hours; on edit-hours → edit-minutes;
    //                 on edit-minutes → edit-month; on edit-month → edit-day-number;
    //                 on edit-day-number → edit-day-letter; on edit-day-letter → default.
    setState((s) => {
      if (s.menu === 'dailyAlarm') {
        if (s.action === 'default') return { menu: 'dailyAlarm', action: 'edit-hours' };
        if (s.action === 'edit-hours') return { menu: 'dailyAlarm', action: 'edit-minutes' };
        if (s.action === 'edit-minutes') return { menu: 'dailyAlarm', action: 'modified' };
        if (s.action === 'modified') return { menu: 'dailyAlarm', action: 'edit-hours' };
      }
      if (s.menu === 'stopwatch') {
        if (s.action === 'default') return { menu: 'stopwatch', action: 'modified' };
        if (s.action === 'modified') return { menu: 'stopwatch', action: 'default' };
      }
      if (s.menu === 'setDateTime') {
        const cycle: Record<CasioAction, CasioAction> = {
          default: 'edit-hours',
          'edit-hours': 'edit-minutes',
          'edit-minutes': 'edit-month',
          'edit-month': 'edit-day-number',
          'edit-day-number': 'edit-day-letter',
          'edit-day-letter': 'default',
          casio: 'default',
          modified: 'default',
        };
        return { menu: 'setDateTime', action: cycle[s.action] };
      }
      return s;
    });
  }, []);

  const pressC = useCallback(() => {
    // C is "menu" — cycles through dateTime → dailyAlarm → stopwatch
    // → setDateTime → dateTime. Plays a "bip" on transition.
    setState((s) => {
      const next: Record<CasioMenu, CasioMenu> = {
        dateTime: 'dailyAlarm',
        dailyAlarm: 'stopwatch',
        stopwatch: 'setDateTime',
        setDateTime: 'dateTime',
      };
      // If we leave stopwatch, stop the stopwatch.
      if (s.menu === 'stopwatch') {
        setStopwatchRunning(false);
        stopwatchSplit.current = null;
        setStopwatchMs(0);
      }
      return { menu: next[s.menu], action: 'default' };
    });
  }, []);

  const pressA = useCallback(() => {
    // A is "start/stop" or "increment". On dateTime/default, holding A
    // for 3s reveals the CA510 easter egg (mode display shows "CA510").
    // On dateTime, A is also a tap that toggles 12/24h mode.
    setState((s) => {
      if (s.menu === 'dateTime' && s.action === 'default') {
        // Start the 3s CA510 timer. On release before 3s, just toggle
        // time mode (12 ↔ 24h).
        if (caTimer.current !== null) window.clearTimeout(caTimer.current);
        caTimer.current = window.setTimeout(() => {
          setState((cur) =>
            cur.menu === 'dateTime' && cur.action === 'default'
              ? { menu: 'dateTime', action: 'casio', casioShownAt: Date.now() }
              : cur,
          );
        }, 3000);
        return s;
      }
      return s;
    });
  }, []);

  const releaseA = useCallback(() => {
    // On a-up before 3s → toggle 12/24h mode (and cancel the CA510 timer).
    if (caTimer.current !== null) {
      window.clearTimeout(caTimer.current);
      caTimer.current = null;
    }
    setState((s) => {
      if (s.menu === 'dateTime' && s.action === 'default') {
        setFlags((f) => ({ ...f, timeMode12: !f.timeMode12 }));
        return s;
      }
      if (s.menu === 'dateTime' && s.action === 'casio') {
        return { menu: 'dateTime', action: 'default' };
      }
      // Stopwatch: toggle run.
      if (s.menu === 'stopwatch') {
        if (s.action === 'default') {
          setStopwatchRunning((r) => !r);
          if (stopwatchRunning) {
            stopwatchSplit.current = null;
            setStopwatchMs(0);
          }
          return s;
        }
        if (s.action === 'modified') {
          // Release the split — restore running display.
          stopwatchSplit.current = null;
          return { menu: 'stopwatch', action: 'default' };
        }
      }
      return s;
    });
  }, [stopwatchRunning]);

  const releaseL = useCallback(() => {
    // L has no release transitions in the reference (it's a tap).
  }, []);

  const releaseC = useCallback(() => {
    // C has no release transitions in the reference (it's a tap).
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL.state);
    setFlags(INITIAL.flags);
    setStopwatchRunning(false);
    stopwatchSplit.current = null;
    setStopwatchMs(0);
  }, []);

  return {
    state,
    flags,
    pressL,
    pressC,
    pressA,
    releaseL,
    releaseC,
    releaseA,
    stopwatchMs,
    reset,
  };
}
