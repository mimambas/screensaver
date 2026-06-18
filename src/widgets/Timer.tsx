// Countdown timer — picks a duration (HH:MM:SS), counts down with
// rAF, beeps + flashes when it hits zero. Distinct from the sleep
// timer (which fades the whole screen to black). Foreground-friendly.
//
// Added in this iteration:
//   - Quick-pick presets (5/10/15/25/45/60 min) via a one-click row.
//   - Keyboard shortcuts: Space toggles run, R resets, 1-9 select
//     the Nth preset. Documented in the panel as a hint pill so
//     the user knows what's available.
//   - The custom value still works — the "Custom…" button drops
//     back to the number input.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Hourglass, Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { playChime } from './audio';
import type { ThemeName } from './clock-constants';
import { useT } from '../i18n';

const STORAGE_KEY = 'screensaver.timer.v1';

const PRESET_MINUTES = [5, 10, 15, 25, 45, 60] as const;

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
  const t = useT();
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
  // Whether the user has picked a preset (so we hide the number
  // input). The "Custom…" button flips this back to false.
  const [presetActive, setPresetActive] = useState<boolean>(() => {
    const d = loadDraft();
    return (PRESET_MINUTES as readonly number[]).includes(Math.round(d.totalMs / 60_000));
  });

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

  // Imperative refs for the keyboard shortcuts. The handlers are
  // registered in a single useEffect (keydown listener); they read
  // from refs so the listener doesn't have to be re-bound every
  // time `running` changes.
  const runningRef = useRef(running);
  const totalMsRef = useRef(totalMs);
  useEffect(() => {
    runningRef.current = running;
    totalMsRef.current = totalMs;
  }, [running, totalMs]);

  const reset = useCallback((ms?: number) => {
    setRunning(false);
    setDone(false);
    if (typeof ms === 'number') {
      setTotalMs(ms);
      setRemainingMs(ms);
      saveDraft(ms, ms);
    } else {
      setRemainingMs(totalMsRef.current);
      saveDraft(totalMsRef.current, totalMsRef.current);
    }
  }, []);

  const start = useCallback(() => {
    if (remainingMs <= 0) return;
    setDone(false);
    setRunning(true);
  }, [remainingMs]);

  const toggleRun = useCallback(() => {
    if (remainingMs <= 0) return;
    setRunning((r) => !r);
  }, [remainingMs]);

  // Keyboard shortcuts: Space toggles run, R resets, 1-9 select
  // a preset. The 1-9 mapping: 1 = 5min (1st preset), 2 = 10min, …
  // up to 6 = 60min. Keys 7-9 are no-ops.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        toggleRun();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reset();
      } else if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const preset = PRESET_MINUTES[idx];
        if (preset !== undefined) {
          e.preventDefault();
          const ms = preset * 60_000;
          setTotalMs(ms);
          setRemainingMs(ms);
          saveDraft(ms, ms);
          setPresetActive(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleRun, reset]);

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

  const applyPreset = (minutes: number) => {
    const ms = minutes * 60_000;
    setTotalMs(ms);
    setRemainingMs(ms);
    saveDraft(ms, ms);
    setPresetActive(true);
    setDone(false);
  };

  return (
    <div
      className={`text-sm rounded-2xl border p-3 ${card} ${done ? 'animate-pulse' : ''}`}
      data-testid="timer-widget"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`text-xs uppercase tracking-widest flex items-center gap-1 ${label}`}>
          <Hourglass className="w-3 h-3" /> Timer
        </div>
        <button
          type="button"
          onClick={() => setShowSet((v) => !v)}
          className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'hover:bg-white/10' : isClaude ? 'hover:bg-[#d4b896]/40' : 'hover:bg-black/10'} ${sub}`}
        >
          {showSet ? t('common.cancel') : 'set'}
        </button>
      </div>

      {/* Quick-pick presets — always visible above the readout.
          Tapping a preset snaps the timer to that duration and
          starts paused (the user still has to press play). The
          "Custom…" button drops back to the number input. */}
      <div className="mb-2">
        <div className={`text-[10px] uppercase tracking-widest mb-1 ${sub}`}>
          {t('timer.presets')}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {PRESET_MINUTES.map((m, idx) => {
            const isActive = presetActive && Math.round(totalMs / 60_000) === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => applyPreset(m)}
                data-testid={`timer-preset-${m}`}
                className={`text-[10px] py-1 rounded transition-colors ${
                  isActive
                    ? isDark
                      ? 'bg-white/20 text-white'
                      : isClaude
                      ? 'bg-[#3a2e1f]/15 text-[#3a2e1f]'
                      : 'bg-black/15 text-black'
                    : isDark
                    ? 'bg-white/5 hover:bg-white/10 text-white/70'
                    : isClaude
                    ? 'bg-[#3a2e1f]/5 hover:bg-[#3a2e1f]/10 text-[#3a2e1f]/70'
                    : 'bg-black/5 hover:bg-black/10 text-black/70'
                }`}
                title={`${m} min · ${idx + 1}`}
              >
                <Zap className="w-2.5 h-2.5 inline-block mr-0.5 opacity-60" />
                {t('timer.preset', { n: m })}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setShowSet(true);
              setPresetActive(false);
            }}
            data-testid="timer-preset-custom"
            className={`text-[10px] py-1 rounded transition-colors ${
              !presetActive
                ? isDark
                  ? 'bg-white/15 text-white'
                  : isClaude
                  ? 'bg-[#3a2e1f]/10 text-[#3a2e1f]'
                  : 'bg-black/10 text-black'
                : isDark
                ? 'bg-white/5 hover:bg-white/10 text-white/70'
                : isClaude
                ? 'bg-[#3a2e1f]/5 hover:bg-[#3a2e1f]/10 text-[#3a2e1f]/70'
                : 'bg-black/5 hover:bg-black/10 text-black/70'
            }`}
          >
            {t('timer.custom')}
          </button>
        </div>
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
                setPresetActive(false);
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
              setPresetActive(false);
            }}
            className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : isClaude ? 'bg-[#d4b896] hover:bg-[#c4a880] text-[#3a2e1f]' : 'bg-black/10 hover:bg-black/20 text-black'}`}
          >
            set
          </button>
        </div>
      ) : (
        <>
          <div
            data-testid="timer-readout"
            className={`text-2xl font-light tabular-nums leading-none ${done ? 'text-red-500' : ''}`}
          >
            {hh}:{mm}:{ss}
          </div>
          <div className="flex items-center gap-1 mt-2">
            {!running ? (
              <button
                type="button"
                onClick={start}
                disabled={remainingMs <= 0}
                aria-label={t('timer.start')}
                data-testid="timer-start"
                className={`p-1.5 rounded ${remainingMs <= 0 ? 'opacity-30 cursor-not-allowed' : isDark ? 'hover:bg-white/10' : isClaude ? 'hover:bg-[#d4b896]/40' : 'hover:bg-black/10'}`}
              >
                <Play className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRunning(false)}
                aria-label={t('timer.pause')}
                data-testid="timer-pause"
                className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : isClaude ? 'hover:bg-[#d4b896]/40' : 'hover:bg-black/10'}`}
              >
                <Pause className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => reset()}
              aria-label={t('timer.reset')}
              data-testid="timer-reset"
              className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : isClaude ? 'hover:bg-[#d4b896]/40' : 'hover:bg-black/10'}`}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            {done && (
              <span className="text-[10px] text-red-500 ml-auto animate-pulse">done</span>
            )}
          </div>
          <div
            data-testid="timer-shortcut-hint"
            className={`text-[9px] mt-1.5 ${sub}`}
          >
            {t('timer.shortcutHint')}
          </div>
        </>
      )}
    </div>
  );
}
