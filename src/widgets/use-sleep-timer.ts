// SleepTimer state machine + handle. Extracted to its own file so the
// `react-refresh/only-export-components` rule is satisfied — the file
// only exports one hook, no components.

import { useEffect, useState, useRef, useCallback } from 'react';
import { playChime } from './audio';

export interface SleepTimerHandle {
  isAsleep: boolean;
  remainingMs: number;
  active: boolean;
  start: (minutes: number) => void;
  cancel: () => void;
  wake: () => void;
}

interface SleepTimerState {
  endsAt: number;
  minutes: number;
}

const STORAGE_KEY = 'screensaver.sleep.v1';

function load(): SleepTimerState {
  if (typeof window === 'undefined') return { endsAt: 0, minutes: 30 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { endsAt: 0, minutes: 30 };
    const j = JSON.parse(raw) as Partial<SleepTimerState>;
    return {
      endsAt: typeof j.endsAt === 'number' ? j.endsAt : 0,
      minutes: typeof j.minutes === 'number' ? j.minutes : 30,
    };
  } catch {
    return { endsAt: 0, minutes: 30 };
  }
}

function save(s: SleepTimerState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function useSleepTimer(): SleepTimerHandle {
  const [state, setState] = useState<SleepTimerState>(load);
  const [now, setNow] = useState(() => Date.now());
  const [isAsleep, setIsAsleep] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const initial = load();
      if (initial.endsAt > 0) {
        const remaining = initial.endsAt - Date.now();
        if (remaining <= 0) {
          // Was asleep when we last closed the tab.
          queueMicrotask(() => setIsAsleep(true));
        }
      }
    }
  }, []);

  useEffect(() => {
    save(state);
  }, [state]);

  useEffect(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (state.endsAt === 0) return;
    intervalRef.current = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= state.endsAt) {
        playChime();
        setIsAsleep(true);
        setState((s) => ({ ...s, endsAt: 0 }));
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.endsAt]);

  const start = useCallback((minutes: number) => {
    if (minutes <= 0) return;
    setIsAsleep(false);
    setState({ endsAt: Date.now() + minutes * 60_000, minutes });
  }, []);

  const cancel = useCallback(() => {
    setIsAsleep(false);
    setState((s) => ({ ...s, endsAt: 0 }));
  }, []);

  const wake = useCallback(() => {
    setIsAsleep(false);
    setState((s) => ({ ...s, endsAt: 0 }));
  }, []);

  const remainingMs = state.endsAt > 0 ? Math.max(0, state.endsAt - now) : 0;
  const active = state.endsAt > 0 && remainingMs > 0;

  return { isAsleep, remainingMs, active, start, cancel, wake };
}
