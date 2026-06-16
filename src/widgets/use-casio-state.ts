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

// --------------------------------------------------------------------------
// F-91W "bip" sound — the reference uses /sound/bip.mp3 from the original
// demo. We load it once and reuse the Audio instance. Mute state is
// exposed so the parent can wire it to a UI toggle.
// --------------------------------------------------------------------------

let _bipAudio: HTMLAudioElement | null = null;
function getBip(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!_bipAudio) {
    _bipAudio = new Audio('/sound/casio-bip.mp3');
    _bipAudio.preload = 'auto';
  }
  return _bipAudio;
}
let _bipMuted = false;
export function setCasioBipMuted(muted: boolean) {
  _bipMuted = muted;
  if (_bipAudio) _bipAudio.muted = muted;
}
export function isCasioBipMuted(): boolean {
  return _bipMuted;
}
function playBip() {
  if (_bipMuted) return;
  const a = getBip();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play();
  } catch {
    // Autoplay policy: the user hasn't interacted yet. Ignore.
  }
}

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
  /** Current alarm time (user-editable). */
  alarmTime: Date;
  /** ms offset added to `new Date()` to compute the watch's wall time. */
  dateTimeOffset: number;
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

  // Auto-repeat for held A on edit-* actions: 1s delay, then increment
  // every 100ms. The increment function is set by pressA (latest closure)
  // and invoked by the interval via a ref so we always read fresh state.
  const autoRepeatTimeoutRef = useRef<number | null>(null);
  const autoRepeatIntervalRef = useRef<number | null>(null);
  const autoRepeatTickRef = useRef<(() => void) | null>(null);

  // Date/time offset for setDateTime. The reference lets the user adjust
  // the wall clock; we track an offset in ms that, added to `new Date()`,
  // gives the user's chosen "watch time". Initially 0.
  const [dateTimeOffset, setDateTimeOffset] = useState(0);
  const [alarmTime, setAlarmTime] = useState(() => {
    const d = new Date();
    d.setHours(7);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  });

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

  // Use a ref so the auto-repeat closure can read the latest state
  // without us having to put `state` in the deps array (which would
  // re-create the callbacks every state change, breaking the auto-repeat
  // interval's ref identity).
  const stateRef = useRef(state);
  const flagsRef = useRef(flags);
  useEffect(() => {
    stateRef.current = state;
    flagsRef.current = flags;
  }, [state, flags]);

  useEffect(() => {
    // Define the increment fn for the currently-pressed edit action.
    // The reference does this inline; we wrap it in a ref callback that
    // gets set on every pressA so the interval always sees fresh state.
    autoRepeatTickRef.current = () => {
      const s = stateRef.current;
      const f = flagsRef.current;
      if (s.menu === 'dailyAlarm') {
        if (s.action === 'edit-hours') {
          setAlarmTime((d) => {
            const nd = new Date(d);
            nd.setHours(nd.getHours() + 1);
            return nd;
          });
        } else if (s.action === 'edit-minutes') {
          setAlarmTime((d) => {
            const nd = new Date(d);
            nd.setMinutes(nd.getMinutes() + 1);
            return nd;
          });
        }
      } else if (s.menu === 'setDateTime') {
        if (s.action === 'edit-minutes') {
          setDateTimeOffset((o) => o - 60_000);
        } else if (s.action === 'edit-hours') {
          setDateTimeOffset((o) => o - 3_600_000);
        } else if (s.action === 'edit-month') {
          setDateTimeOffset((o) => {
            const d = new Date(Date.now() + o);
            d.setMonth(d.getMonth() + 1);
            return o - (d.getTime() - (Date.now() + o));
          });
        } else if (s.action === 'edit-day-number') {
          setDateTimeOffset((o) => {
            const d = new Date(Date.now() + o);
            d.setDate(d.getDate() + 1);
            return o - (d.getTime() - (Date.now() + o));
          });
        }
      }
      void f;
    };
  });

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
    let played = false;
    setState((s) => {
      if (s.menu === 'dailyAlarm') {
        played = true;
        if (s.action === 'default') return { menu: 'dailyAlarm', action: 'edit-hours' };
        if (s.action === 'edit-hours') return { menu: 'dailyAlarm', action: 'edit-minutes' };
        if (s.action === 'edit-minutes') return { menu: 'dailyAlarm', action: 'modified' };
        if (s.action === 'modified') return { menu: 'dailyAlarm', action: 'edit-hours' };
      }
      if (s.menu === 'stopwatch') {
        played = true;
        if (s.action === 'default') return { menu: 'stopwatch', action: 'modified' };
        if (s.action === 'modified') return { menu: 'stopwatch', action: 'default' };
      }
      if (s.menu === 'setDateTime') {
        played = true;
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
    if (played) playBip();
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
    playBip();
  }, []);

  const pressA = useCallback(() => {
    // A is the most complex button. From the reference (os.js):
    //   dateTime:  isDown starts 3s CA510 timer; release toggles 12/24h.
    //   dailyAlarm: default → cycle alarmOn/timeSignal flags; edit-* →
    //                increment hours/minutes (held = auto-repeat at 100ms).
    //   stopwatch: toggle run, with bip.
    //   setDateTime: default → +1 second; edit-* → increment that field
    //                (held = auto-repeat at 100ms after 1s).
    setState((s) => {
      if (s.menu === 'dateTime' && s.action === 'default') {
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

    // Below: synchronous side-effects (bip, flag toggles, increment
    // kicks) based on the current menu/action.
    setFlags((f) => {
      if (!state) return f;
      if (state.menu !== 'dailyAlarm' || state.action !== 'default') return f;
      // Cycle the alarmOn + timeSignal pair in this order:
      //   both on → only signal on → only alarm on → both on
      // (the reference toggles the off one ON, not strictly cycle; this
      // is a simplification that matches the demo's behaviour for the
      // 3 typical states.)
      if (f.alarmOn && f.hourlyChime) return { ...f, alarmOn: false, hourlyChime: true };
      if (!f.alarmOn && f.hourlyChime) return { ...f, alarmOn: true, hourlyChime: true };
      return { ...f, alarmOn: true, hourlyChime: false };
    });

    playBip();

    // Start an auto-repeat timer for edit-* actions. After 1s, start
    // incrementing every 100ms.
    if (state && state.action.startsWith('edit-')) {
      const id = setTimeout(() => {
        const intervalId = setInterval(() => {
          // Re-read latest state and increment the field.
          // (We mutate the watched value via a ref; see autoRepeatTick.)
          autoRepeatTickRef.current?.();
        }, 100);
        autoRepeatIntervalRef.current = intervalId;
      }, 1000);
      autoRepeatTimeoutRef.current = id;
    }
  }, [state]);

  const releaseA = useCallback(() => {
    // On a-up:
    //   dateTime/default + <3s: toggle 12/24h
    //   dateTime/casio: back to default
    //   dailyAlarm/edit-*: stop auto-repeat
    //   stopwatch/default: toggle run
    //   stopwatch/modified: back to default (release split)
    if (caTimer.current !== null) {
      window.clearTimeout(caTimer.current);
      caTimer.current = null;
    }
    if (autoRepeatTimeoutRef.current !== null) {
      window.clearTimeout(autoRepeatTimeoutRef.current);
      autoRepeatTimeoutRef.current = null;
    }
    if (autoRepeatIntervalRef.current !== null) {
      window.clearInterval(autoRepeatIntervalRef.current);
      autoRepeatIntervalRef.current = null;
    }
    setState((s) => {
      if (s.menu === 'dateTime' && s.action === 'default') {
        setFlags((f) => ({ ...f, timeMode12: !f.timeMode12 }));
        return s;
      }
      if (s.menu === 'dateTime' && s.action === 'casio') {
        return { menu: 'dateTime', action: 'default' };
      }
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
    alarmTime,
    dateTimeOffset,
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
