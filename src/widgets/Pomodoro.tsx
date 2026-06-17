import { useEffect, useMemo, useState } from 'react';
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
const STATS_KEY = 'screensaver.pomodoro.stats.v1';

type PersistedState = {
  mode: Mode;
  workMin: number;
  shortMin: number;
  longMin: number;
  cyclesCompleted: number;
};

// Daily stats: { 'YYYY-MM-DD': focusMinutes }. We keep ~30 days of
// history for a small weekly bar chart. `cycles` is per-day completed
// work sessions; `hourly` is a 24-element array of minutes indexed
// by hour-of-day, powering the heatmap. Older entries that pre-date
// any field default sensibly (cycles=0, hourly=[]).
type Stats = Record<string, { minutes: number; cycles: number; hourly: number[] }>;

function loadStats(): Stats {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    // Migrate older shapes to the current object shape.
    // v1: { 'YYYY-MM-DD': number }
    // v2: { 'YYYY-MM-DD': { minutes, cycles } }
    // v3: { 'YYYY-MM-DD': { minutes, cycles, hourly: number[24] } }
    const out: Stats = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number') {
        out[k] = { minutes: v, cycles: 0, hourly: [] };
      } else if (v && typeof v === 'object') {
        const entry = v as { minutes?: number; cycles?: number; hourly?: number[] };
        out[k] = {
          minutes: entry.minutes ?? 0,
          cycles: entry.cycles ?? 0,
          hourly: Array.isArray(entry.hourly) && entry.hourly.length === 24 ? entry.hourly : [],
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveStats(stats: Stats) {
  try {
    // Prune entries older than 30 days to keep the storage tidy.
    const cutoff = Date.now() - 30 * 86_400_000;
    const next: Stats = {};
    for (const [k, v] of Object.entries(stats)) {
      const t = new Date(k).getTime();
      if (t >= cutoff) next[k] = v;
    }
    window.localStorage.setItem(STATS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  // Daily focus stats. Persisted on every work-phase completion.
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [showStats, setShowStats] = useState(false);

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
    saveStats(stats);
  }, [stats]);

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
          if (prev === 'work') {
            setCyclesCompleted((c) => c + 1);
            // Log this work session's minutes + a completed cycle to
            // the daily stats. `cycles` powers the "X cycles today"
            // achievement; `hourly` powers the heatmap. We sample the
            // hour at completion time, not at start time — closer to
            // what the user remembers as "the hour I finished".
            setStats((s) => {
              const k = dayKey(new Date());
              const now = new Date();
              const prev = s[k] || { minutes: 0, cycles: 0, hourly: [] };
              const hourly = prev.hourly.length === 24 ? [...prev.hourly] : new Array(24).fill(0);
              hourly[now.getHours()] += workMin;
              return { ...s, [k]: { minutes: prev.minutes + workMin, cycles: prev.cycles + 1, hourly } };
            });
          }
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
    // We intentionally exclude `seconds`, `mode` from deps to keep
    // the interval stable — those reads come from the latest closure
    // via setState. Re-firing every second would reset the timer.
  }, [running, cyclesCompleted, autoStart, workMin]);

  const reset = () => {
    setRunning(false);
    setMode('work');
    setSeconds(DURATIONS.work);
    setCyclesCompleted(0);
    setStats({});
  };

  // Compute stats summaries. We always derive both the 7d and 30d
  // series from the same `stats` map so the toggle is instant.
  type Day = {
    key: string;
    label: string;
    minutes: number;
    cycles: number;
    hourly: number[];
    isToday: boolean;
  };
  const last30 = useMemo<Day[]>(() => {
    const out: Day[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      const entry = stats[k];
      out.push({
        key: k,
        // Compact label: first letter of weekday (M T W T F S S).
        // For 30d view, every 7th bar gets a fuller weekday so the
        // user can still anchor to a specific week.
        label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1),
        minutes: entry?.minutes ?? 0,
        cycles: entry?.cycles ?? 0,
        hourly: entry?.hourly ?? [],
        isToday: i === 0,
      });
    }
    return out;
  }, [stats]);
  const last7 = useMemo<Day[]>(() => last30.slice(-7), [last30]);
  const total7 = useMemo(() => last7.reduce((s, d) => s + d.minutes, 0), [last7]);
  const total30 = useMemo(() => last30.reduce((s, d) => s + d.minutes, 0), [last30]);
  const max7 = useMemo(() => Math.max(1, ...last7.map((d) => d.minutes)), [last7]);
  const max30 = useMemo(() => Math.max(1, ...last30.map((d) => d.minutes)), [last30]);
  const bestDay7 = useMemo(() => Math.max(0, ...last7.map((d) => d.minutes)), [last7]);
  const bestDay30 = useMemo(() => Math.max(0, ...last30.map((d) => d.minutes)), [last30]);
  const daysFocused7 = useMemo(
    () => last7.filter((d) => d.minutes > 0).length,
    [last7],
  );
  // Current daily streak: how many consecutive days (counting back
  // from today) had at least 1 minute of focus.
  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 30; i++) {
      if ((last30[29 - i]?.minutes ?? 0) > 0) s++;
      else break;
    }
    return s;
  }, [last30]);
  // Longest streak within the 30d window. If the current streak is
  // already the longest, `longestStreak === streak` and we skip the
  // "best" badge to avoid noise.
  const longestStreak = useMemo(() => {
    let best = 0;
    let cur = 0;
    for (const d of last30) {
      if (d.minutes > 0) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
    return best;
  }, [last30]);
  const cyclesToday = last30[29]?.cycles ?? 0;
  // 7-row × 24-column heatmap of focus minutes by day-of-week × hour.
  // Each row is one day; we use the LAST 7 days of last30 so the
  // newest day is at the bottom (matches GitHub-style heatmaps).
  const hourly7 = useMemo(() => {
    return last30.slice(-7).map((d, i) => ({
      dayIdx: i, // 0 = oldest of the 7, 6 = today
      key: d.key,
      label: d.label,
      isToday: d.isToday,
      hourly: d.hourly.length === 24 ? d.hourly : new Array(24).fill(0),
      totalMinutes: (d.hourly.length === 24 ? d.hourly : []).reduce((s, n) => s + n, 0),
    }));
  }, [last30]);
  // Largest single-cell value, used to scale cell opacity. We use
  // max(60) as a floor so 1 hour of focus already reads as a full
  // cell — otherwise sparse data looks almost invisible.
  const maxCellMinutes = useMemo(() => {
    let m = 0;
    for (const d of hourly7) for (const v of d.hourly) if (v > m) m = v;
    return Math.max(60, m);
  }, [hourly7]);
  const hoursFocused7 = useMemo(() => {
    let n = 0;
    for (const d of hourly7) for (const v of d.hourly) if (v > 0) n++;
    return n;
  }, [hourly7]);
  // Toggle between 7d and 30d view. Default 7d for tighter signal.
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const series = range === '7d' ? last7 : last30;
  const seriesMax = range === '7d' ? max7 : max30;

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
      <button
        type="button"
        onClick={() => setShowStats((v) => !v)}
        className={`text-[10px] ${labelClass} hover:opacity-80`}
        aria-expanded={showStats}
      >
        {showStats ? '▾ stats' : '▸ stats'} · {total7}m this week · {streak}d streak
      </button>
      {showStats && (
        <div
          className={`w-full ${labelClass} text-[10px] flex flex-col gap-1.5`}
          aria-label={`Last ${range === '7d' ? '7' : '30'} days of focus time`}
        >
          <div className="flex items-center justify-between gap-2">
            <div
              className="inline-flex rounded-full overflow-hidden border border-current/20"
              role="group"
              aria-label="Range"
            >
              {(['7d', '30d'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                  data-range={r}
                  className={`px-2 py-0.5 transition-colors ${
                    range === r
                      ? theme === 'dark'
                        ? 'bg-white/20 text-white'
                        : theme === 'claude'
                        ? 'bg-[#3a2e1f]/15 text-[#3a2e1f]'
                        : 'bg-black/15 text-black'
                      : ''
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="opacity-70 text-right tabular-nums" data-headline>
              {range === '7d'
                ? `${total7} min · ${daysFocused7}d focused · best ${bestDay7}m`
                : `${total30} min · best ${bestDay30}m`}
            </div>
          </div>
          <div
            className={`flex items-end justify-between ${
              range === '7d' ? 'gap-1' : 'gap-0.5'
            } ${range === '7d' ? 'h-12' : 'h-10'}`}
          >
            {series.map((d) => (
              <div
                key={d.key}
                className="flex-1 flex flex-col items-center gap-0.5 min-w-0"
              >
                <div
                  className={`w-full flex items-end ${
                    range === '7d' ? 'h-10' : 'h-8'
                  }`}
                >
                  <div
                    className={`w-full rounded-sm ${fillBg} ${
                      d.isToday ? 'ring-1 ring-current' : ''
                    }`}
                    style={{
                      height: `${(d.minutes / seriesMax) * 100}%`,
                      minHeight: d.minutes > 0 ? 2 : 0,
                    }}
                    title={`${d.minutes}m · ${d.cycles} cycle${d.cycles === 1 ? '' : 's'}`}
                    data-minutes={d.minutes}
                    data-cycles={d.cycles}
                    data-today={d.isToday ? '1' : '0'}
                  />
                </div>
              </div>
            ))}
          </div>
          <div
            className={`flex items-center justify-between ${
              range === '7d' ? 'gap-1' : 'gap-0.5'
            } opacity-60 tabular-nums`}
          >
            {series.map((d, i) => (
              <div
                key={`l-${d.key}`}
                className="flex-1 text-center min-w-0 truncate"
                data-label-idx={i}
              >
                {/* 7d: weekday letter. 30d: weekday letter every 5 bars,
                    otherwise blank — keeps the row readable. */}
                {range === '7d' || i % 5 === 0 || d.isToday ? d.label : ''}
              </div>
            ))}
          </div>
          {/* Achievements row — only render badges that actually apply.
              This is a one-liner so the panel never balloons. */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {streak >= 1 && (
              <span
                className={`px-1.5 py-0.5 rounded-full border border-current/20 ${
                  theme === 'dark' ? 'bg-white/5' : 'bg-black/5'
                }`}
                data-achievement="streak"
              >
                🔥 {streak}d streak
              </span>
            )}
            {longestStreak > streak && longestStreak >= 3 && (
              <span
                className={`px-1.5 py-0.5 rounded-full border border-current/20 ${
                  theme === 'dark' ? 'bg-white/5' : 'bg-black/5'
                }`}
                data-achievement="best-streak"
              >
                🏆 best {longestStreak}d
              </span>
            )}
            {bestDay7 >= 90 && (
              <span
                className={`px-1.5 py-0.5 rounded-full border border-current/20 ${
                  theme === 'dark' ? 'bg-white/5' : 'bg-black/5'
                }`}
                data-achievement="best-day"
              >
                ⭐ best day {bestDay7}m
              </span>
            )}
            {cyclesToday >= 4 && (
              <span
                className={`px-1.5 py-0.5 rounded-full border border-current/20 ${
                  theme === 'dark' ? 'bg-white/5' : 'bg-black/5'
                }`}
                data-achievement="cycles-today"
              >
                📅 {cyclesToday} cycles today
              </span>
            )}
            {total7 >= 600 && (
              <span
                className={`px-1.5 py-0.5 rounded-full border border-current/20 ${
                  theme === 'dark' ? 'bg-white/5' : 'bg-black/5'
                }`}
                data-achievement="10h-week"
              >
                💪 10h this week
              </span>
            )}
          </div>
          {/* Heatmap — collapsible 7×24 grid of focus minutes by
              hour-of-day. Cell opacity scales to the largest cell in
              the window (floor: 60 min so 1 hr reads as a full cell). */}
          <button
            type="button"
            onClick={() => setShowHeatmap((v) => !v)}
            className={`text-[10px] ${labelClass} hover:opacity-80 self-start`}
            aria-expanded={showHeatmap}
          >
            {showHeatmap ? '▾ heatmap' : '▸ heatmap'} · {hoursFocused7}h focused
          </button>
          {showHeatmap && (
            <div
              className="w-full flex flex-col gap-0.5"
              aria-label="7 days × 24 hours focus heatmap"
            >
              {/* Hour ticks (above) — 0, 6, 12, 18, 23. Spans the
                  first 24 columns; we use a 1fr grid with the first
                  col reserved for weekday labels. */}
              <div className="grid grid-cols-[12px_repeat(24,1fr)] gap-0.5 text-[8px] opacity-50">
                <span />
                {[0, 6, 12, 18].map((h) => (
                  <span
                    key={h}
                    className="text-center"
                    style={{ gridColumn: `${h + 2} / span 6` }}
                  >
                    {h}
                  </span>
                ))}
              </div>
              {hourly7.map((d) => (
                <div
                  key={d.key}
                  className={`grid grid-cols-[12px_repeat(24,1fr)] gap-0.5 items-center ${
                    d.isToday ? 'ring-1 ring-current rounded-sm' : ''
                  }`}
                  data-day-row={d.dayIdx}
                >
                  <span className="text-[8px] opacity-60 text-right pr-0.5">
                    {d.label}
                  </span>
                  {d.hourly.map((mins, h) => (
                    <span
                      key={h}
                      data-cell
                      data-day={d.dayIdx}
                      data-hour={h}
                      data-minutes={mins}
                      className={`h-2 rounded-[1px] ${fillBg}`}
                      style={{
                        opacity: mins > 0 ? Math.max(0.15, mins / maxCellMinutes) : 0,
                      }}
                    />
                  ))}
                </div>
              ))}
              <div className={`text-[9px] opacity-50 mt-0.5 ${labelClass}`}>
                opacity ∝ minutes · today has ring
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
