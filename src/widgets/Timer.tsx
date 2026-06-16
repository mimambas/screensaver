// Countdown timer — picks a duration (HH:MM:SS), counts down with
// rAF, beeps + flashes when it hits zero. Distinct from the sleep
// timer (which fades the whole screen to black). Foreground-friendly.

import { useEffect, useRef, useState } from 'react';
import { Hourglass, Play, Pause, RotateCcw } from 'lucide-react';
import { playChime } from './audio';
import type { ThemeName } from './clock-constants';

const STORAGE_KEY = 'screensaver.timer.v1';

function loadDraft(): { totalMs: number; remainingMs: number; running: boolean } {
  if (typeof window === 'undefined') {
    return { totalMs: 5 * 60_000, remainingMs: 5 * 60_000, running: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { totalMs: 5 * 60_000, remainingMs: 5 * 60_000, running: false };
    const parsed = JSON.parse(raw) as { totalMs: number; remainingMs: number; running: boolean };
    if (typeof parsed.totalMs !== 'number' || typeof parsed.remainingMs !== 'number') {
      return { totalMs: 5 * 60_000, remainingMs: 5 * 60_000, running: false };
    }
    return {
      totalMs: Math.max(0, parsed.totalMs),
      remainingMs: Math.max(0, Math.min(parsed.remainingMs, parsed.totalMs)),
      running: false, // never auto-resume on load
    };
  } catch {
    return { totalMs: 5 * 60_000, remainingMs: 5 * 60_000, running: false };
  }
}

function saveDraft(totalMs: number, remainingMs: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ totalMs, remainingMs }));
  } catch {
    // ignore
  }
}

function format(ms: number): { hh: string; mm: string; ss: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return {
    hh: String(hh).padStart(2, '0'),
    mm: String(mm).padStart(2, '0'),
    ss: String(ss).padStart(2, '0'),
  };
}

export function Timer({ theme = 'dark' }: { theme?: ThemeName }) {
  // Initial load from localStorage. We use the lazy useState init so
  // localStorage is read once at mount, not in an effect.
  const [{ totalMs, remainingMs }, setState] = useState(() => {
    const d = loadDraft();
    return { totalMs: d.totalMs, remainingMs: d.remainingMs };
  });
  const setTotalMs = (v: number) => setState((s) => ({ ...s, totalMs: v }));
  const setRemainingMs = (v: number) => setState((s) => ({ ...s, remainingMs: v }));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [showSet, setShowSet] = useState(false);
  const [draftMin, setDraftMin] = useState(() =>
    Math.max(1, Math.round(loadDraft().totalMs / 60_000)),
  );

  // Persist on every change (running, total, remaining)
  useEffect(() => {
    if (totalMs > 0) saveDraft(totalMs, remainingMs);
  }, [totalMs, remainingMs]);

  // rAF-driven countdown
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);
  useEffect(() => {
    if (!running) {
      startRef.current = null;
      return;
    }
    startRef.current = performance.now();
    baseRef.current = remainingMs;
    let raf = 0;
    const tick = () => {
      if (startRef.current === null) return;
      const elapsed = performance.now() - startRef.current;
      const next = Math.max(0, baseRef.current - elapsed);
      setRemainingMs(next);
      if (next <= 0) {
        setRunning(false);
        setDone(true);
        playChime();
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss "done" flash after 8s
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(false), 8000);
    return () => window.clearTimeout(id);
  }, [done]);

  const reset = (ms?: number) => {
    setRunning(false);
    setDone(false);
    if (typeof ms === 'number') {
      setTotalMs(ms);
      setRemainingMs(ms);
      saveDraft(ms, ms);
    } else {
      setRemainingMs(totalMs);
      saveDraft(totalMs, totalMs);
    }
  };

  const start = () => {
    if (remainingMs <= 0) return;
    setDone(false);
    setRunning(true);
  };

  const isDark = theme === 'dark';
  const isClaude = theme === 'claude';
  const label = isDark ? 'text-white/60' : isClaude ? 'text-[#3a2e1f]/60' : 'text-black/60';
  const sub = isDark ? 'text-white/40' : isClaude ? 'text-[#3a2e1f]/40' : 'text-black/40';
  const card = isDark
    ? 'bg-white/5 border-white/10'
    : isClaude
    ? 'bg-[#e8dcc4]/40 border-[#3a2e1f]/15'
    : 'bg-black/5 border-black/10';
  const { hh, mm, ss } = format(remainingMs);

  return (
    <div className={`text-sm rounded-2xl border p-3 ${card} ${done ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`text-xs uppercase tracking-widest flex items-center gap-1 ${label}`}>
          <Hourglass className="w-3 h-3" /> Timer
        </div>
        <button
          type="button"
          onClick={() => setShowSet((v) => !v)}
          className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'hover:bg-white/10' : isClaude ? 'hover:bg-[#d4b896]/40' : 'hover:bg-black/10'} ${sub}`}
        >
          {showSet ? 'cancel' : 'set'}
        </button>
      </div>
      {showSet ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={480}
            value={draftMin}
            onChange={(e) => setDraftMin(Math.max(1, Math.min(480, Number(e.target.value) || 0)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const ms = draftMin * 60_000;
                reset(ms);
                setShowSet(false);
              } else if (e.key === 'Escape') {
                setShowSet(false);
              }
            }}
            className={`flex-1 bg-transparent text-sm outline-none tabular-nums ${isDark ? 'text-white' : isClaude ? 'text-[#3a2e1f]' : 'text-black'}`}
          />
          <span className={`text-[10px] ${sub}`}>min</span>
          <button
            type="button"
            onClick={() => {
              const ms = draftMin * 60_000;
              reset(ms);
              setShowSet(false);
            }}
            className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : isClaude ? 'bg-[#d4b896] hover:bg-[#c4a880] text-[#3a2e1f]' : 'bg-black/10 hover:bg-black/20 text-black'}`}
          >
            set
          </button>
        </div>
      ) : (
        <>
          <div className={`text-2xl font-light tabular-nums leading-none ${done ? 'text-red-500' : ''}`}>
            {hh}:{mm}:{ss}
          </div>
          <div className="flex items-center gap-1 mt-2">
            {!running ? (
              <button
                type="button"
                onClick={start}
                disabled={remainingMs <= 0}
                aria-label="Start timer"
                className={`p-1.5 rounded ${remainingMs <= 0 ? 'opacity-30 cursor-not-allowed' : isDark ? 'hover:bg-white/10' : isClaude ? 'hover:bg-[#d4b896]/40' : 'hover:bg-black/10'}`}
              >
                <Play className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRunning(false)}
                aria-label="Pause timer"
                className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : isClaude ? 'hover:bg-[#d4b896]/40' : 'hover:bg-black/10'}`}
              >
                <Pause className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => reset()}
              aria-label="Reset timer"
              className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : isClaude ? 'hover:bg-[#d4b896]/40' : 'hover:bg-black/10'}`}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            {done && (
              <span className="text-[10px] text-red-500 ml-auto animate-pulse">done</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
