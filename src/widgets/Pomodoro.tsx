import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react';
import { playChime } from './audio';
import type { ThemeName } from './clock-constants';

type Mode = 'work' | 'short' | 'long';

const DURATIONS: Record<Mode, number> = {
  work: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const LABELS: Record<Mode, string> = {
  work: 'Focus',
  short: 'Short Break',
  long: 'Long Break',
};

const STORAGE_KEY = 'screensaver.pomodoro.v1';

type PersistedState = {
  mode: Mode;
  workMin: number;
  shortMin: number;
  longMin: number;
  cyclesCompleted: number;
};

function loadState(): PersistedState {
  const fallback: PersistedState = {
    mode: 'work',
    workMin: 25,
    shortMin: 5,
    longMin: 15,
    cyclesCompleted: 0,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<PersistedState>) };
  } catch {
    return fallback;
  }
}

function fmt(seconds: number) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return { mm, ss };
}

export function Pomodoro({ theme = 'dark' }: { theme?: ThemeName }) {
  const persisted = loadState();
  const [mode, setMode] = useState<Mode>(persisted.mode);
  const [workMin, setWorkMin] = useState(persisted.workMin);
  const [shortMin, setShortMin] = useState(persisted.shortMin);
  const [longMin, setLongMin] = useState(persisted.longMin);
  const [cyclesCompleted, setCyclesCompleted] = useState(persisted.cyclesCompleted);
  const [seconds, setSeconds] = useState(() => {
    // Resume from 0 on load — most predictable
    return DURATIONS[persisted.mode];
  });
  const [running, setRunning] = useState(false);
  // Briefly flash the timer display when a phase ends, so the user
  // can see the chime + transition even if the screen is off-axis.
  const [flash, setFlash] = useState(false);
  // Auto-start the next phase when a work session ends. Reference
  // behavior of the canonical Pomodoro timer. User can stop a phase
  // by pausing; auto-start is the default.
  const [autoStart, setAutoStart] = useState(true);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode, workMin, shortMin, longMin, cyclesCompleted }),
      );
    } catch {
      // localStorage may be unavailable
    }
  }, [mode, workMin, shortMin, longMin, cyclesCompleted]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s > 1) return s - 1;
        // Reached zero — auto-advance
        playChime();
        setFlash(true);
        window.setTimeout(() => setFlash(false), 800);
        setMode((prev) => {
          const next: Mode =
            prev === 'work'
              ? cyclesCompleted > 0 && cyclesCompleted % 4 === 0
                ? 'long'
                : 'short'
              : 'work';
          if (prev === 'work') setCyclesCompleted((c) => c + 1);
          setSeconds(DURATIONS[next]);
          if (autoStart) {
            // Kick the next phase after a brief pause so the user sees
            // the transition. 1.5s feels natural.
            window.setTimeout(() => setRunning(true), 1500);
          } else {
            setRunning(false);
          }
          return next;
        });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // We intentionally exclude `seconds`, `mode`, `cyclesCompleted` to keep the
    // interval stable — state reads are taken from the latest closure via setState.
  }, [running, cyclesCompleted, autoStart]);

  const reset = () => {
    setRunning(false);
    setMode('work');
    setSeconds(DURATIONS.work);
    setCyclesCompleted(0);
  };

  const skip = () => {
    setRunning(false);
    const next: Mode = mode === 'work' ? 'short' : 'work';
    setMode(next);
    setSeconds(DURATIONS[next]);
  };

  const adjustDuration = (kind: Mode, delta: number) => {
    if (running) return;
    if (kind === 'work') {
      const v = Math.max(1, Math.min(90, workMin + delta));
      setWorkMin(v);
      if (mode === 'work') setSeconds(v * 60);
    } else if (kind === 'short') {
      const v = Math.max(1, Math.min(30, shortMin + delta));
      setShortMin(v);
      if (mode === 'short') setSeconds(v * 60);
    } else {
      const v = Math.max(5, Math.min(60, longMin + delta));
      setLongMin(v);
      if (mode === 'long') setSeconds(v * 60);
    }
  };

  const totalSec = mode === 'work' ? workMin * 60 : mode === 'short' ? shortMin * 60 : longMin * 60;
  const progress = totalSec > 0 ? ((totalSec - seconds) / totalSec) * 100 : 0;
  const { mm, ss } = fmt(seconds);

  const labelClass = theme === 'dark' ? 'text-white/70' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'text-black/70';
  const btnHover = theme === 'dark' ? 'hover:bg-white/10' : theme === 'claude' ? 'hover:bg-[#d4b896]/30' : 'hover:bg-black/10';
  const trackBg = theme === 'dark' ? 'bg-white/15' : theme === 'claude' ? 'bg-[#d4b896]/40' : 'bg-black/15';
  const fillBg =
    mode === 'work'
      ? theme === 'dark' ? 'bg-white/70' : theme === 'claude' ? 'bg-[#a87a4a]' : 'bg-black/70'
      : mode === 'short'
      ? theme === 'dark' ? 'bg-emerald-400/70' : 'bg-emerald-500/70'
      : theme === 'dark' ? 'bg-sky-400/70' : 'bg-sky-500/70';
  // Color of the digit per phase. Tells the user at a glance which
  // mode the timer is in.
  const digitColor =
    mode === 'work'
      ? theme === 'dark' ? 'text-white' : theme === 'claude' ? 'text-[#3a2e1f]' : 'text-black'
      : mode === 'short'
      ? theme === 'dark' ? 'text-emerald-300' : 'text-emerald-600'
      : theme === 'dark' ? 'text-sky-300' : 'text-sky-600';
  const muteSpan = theme === 'dark' ? 'text-white/40' : theme === 'claude' ? 'text-[#3a2e1f]/40' : 'text-black/40';
  // Subtle card tint during break, so the widget itself feels
  // different without tinting the rest of the screen.
  const cardTint =
    mode === 'work'
      ? ''
      : mode === 'short'
      ? theme === 'dark' ? 'bg-emerald-500/5' : 'bg-emerald-500/10'
      : theme === 'dark' ? 'bg-sky-500/5' : 'bg-sky-500/10';
  const cardBorder =
    mode === 'work'
      ? theme === 'dark' ? 'border-white/10' : theme === 'claude' ? 'border-[#3a2e1f]/15' : 'border-black/10'
      : mode === 'short'
      ? theme === 'dark' ? 'border-emerald-400/30' : 'border-emerald-500/30'
      : theme === 'dark' ? 'border-sky-400/30' : 'border-sky-500/30';

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border p-4 transition-colors duration-700 ${cardTint} ${cardBorder}`}
    >
      {/* Cycle indicator — 4 dots showing completed work sessions out
          of 4 (every 4th = long break). */}
      <div
        className="flex gap-1.5"
        aria-label={`${cyclesCompleted} focus sessions completed`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i < (cyclesCompleted % 4)
                ? fillBg
                : theme === 'dark'
                ? 'bg-white/15'
                : theme === 'claude'
                ? 'bg-[#3a2e1f]/15'
                : 'bg-black/15'
            }`}
          />
        ))}
      </div>
      <div className="flex gap-1 text-[10px]">
        {(['work', 'short', 'long'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (running) return;
              setMode(m);
              setSeconds(m === 'work' ? workMin * 60 : m === 'short' ? shortMin * 60 : longMin * 60);
            }}
            disabled={running}
            className={`px-2 py-1 rounded-full uppercase tracking-widest transition-colors ${
              mode === m
                ? theme === 'dark' ? 'bg-white/20 text-white' : theme === 'claude' ? 'bg-[#3a2e1f]/15 text-[#3a2e1f]' : 'bg-black/15 text-black'
                : `${labelClass} ${btnHover} disabled:opacity-40`
            }`}
          >
            {m === 'work' ? '🎯' : m === 'short' ? '☕' : '🧘'} {m}
          </button>
        ))}
      </div>
      <div className={`text-xs uppercase tracking-widest ${labelClass}`}>
        {LABELS[mode]}
        {mode === 'work' && cyclesCompleted > 0 && (
          <span className="ml-2 opacity-60">· cycle {cyclesCompleted + 1}</span>
        )}
      </div>
      <div
        className={`text-6xl font-thin tabular-nums tracking-tighter transition-colors duration-300 ${digitColor}`}
        style={{ transform: flash ? 'scale(1.1)' : 'scale(1)' }}
      >
        {mm}<span className={muteSpan}>:</span>{ss}
      </div>
      <div className={`w-48 h-1 ${trackBg} rounded-full overflow-hidden`}>
        <div
          className={`h-full ${fillBg} transition-all duration-1000 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center gap-1 text-[10px] opacity-60">
        <button
          type="button"
          onClick={() => adjustDuration(mode, -5)}
          disabled={running}
          className={`px-1.5 py-0.5 rounded ${btnHover} disabled:opacity-30`}
          aria-label="Decrease duration"
        >
          −5
        </button>
        <span className="px-1">{mode === 'work' ? workMin : mode === 'short' ? shortMin : longMin}m</span>
        <button
          type="button"
          onClick={() => adjustDuration(mode, 5)}
          disabled={running}
          className={`px-1.5 py-0.5 rounded ${btnHover} disabled:opacity-30`}
          aria-label="Increase duration"
        >
          +5
        </button>
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? 'Pause' : 'Start'}
          className={`p-2 rounded-full transition-colors ${btnHover}`}
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={skip}
          aria-label="Skip phase"
          title="Skip to next phase"
          className={`p-2 rounded-full transition-colors ${btnHover}`}
        >
          {mode === 'work' ? <Coffee className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
        </button>
        <button
          onClick={reset}
          aria-label="Reset"
          className={`p-2 rounded-full transition-colors ${btnHover}`}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
      <label
        className={`flex items-center gap-1.5 text-[10px] cursor-pointer ${labelClass}`}
      >
        <input
          type="checkbox"
          checked={autoStart}
          onChange={(e) => setAutoStart(e.target.checked)}
          className="accent-current"
        />
        auto-start next
      </label>
    </div>
  );
}
