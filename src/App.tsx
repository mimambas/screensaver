import { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Settings, Minus, Plus } from 'lucide-react';
import {
  DigitalClock,
  WorldClock,
  DateDisplay,
} from './widgets/Clock';
import {
  CLOCK_STYLES,
  CLOCK_COLORS,
  CLOCK_SIZES,
  CLOCK_SIZE_PRESETS,
  clampClockSize,
  type ClockStyle,
  type ClockColor,
  type ClockSize,
  type ThemeName,
} from './widgets/clock-constants';
import { Pomodoro } from './widgets/Pomodoro';
import { Stopwatch } from './widgets/Stopwatch';
import { Weather } from './widgets/Weather';
import { Quotes } from './widgets/Quotes';
import { DayProgress } from './widgets/DayProgress';
import { useSleepTimer } from './widgets/use-sleep-timer';
import { SleepTimerOverlay, SleepTimerChip } from './widgets/SleepTimer';
import { AlarmList } from './widgets/AlarmList';
import { Timer } from './widgets/Timer';

type Layout = 'classic' | 'split' | 'minimal';

const isDark = (t: ThemeName) => t === 'dark';
const isClaude = (t: ThemeName) => t === 'claude';

const SETTINGS_KEY = 'screensaver.settings.v2';

type PersistedSettings = {
  layout: Layout;
  theme: ThemeName;
  clockStyle: ClockStyle;
  clockColor: ClockColor;
  clockSize: ClockSize;
  showDate: boolean;
  dateLocale: string;
  dateFormat: 'long' | 'short' | 'iso';
  showWorldClock: boolean;
  showQuote: boolean;
  showWeather: boolean;
  showStopwatch: boolean;
  showPomodoro: boolean;
  showDayProgress: boolean;
  showAlarms: boolean;
  showTimer: boolean;
  flipSound: boolean;
  city: string;
  /** Auto-switch theme by local hour (6-18 = light, else dark). */
  autoTheme: boolean;
};

const DEFAULTS: PersistedSettings = {
  layout: 'classic',
  theme: 'dark',
  clockStyle: 'digital',
  clockColor: 'white',
  clockSize: CLOCK_SIZE_PRESETS.default,
  showDate: true,
  showWorldClock: true,
  showQuote: true,
  showWeather: true,
  showStopwatch: true,
  showPomodoro: true,
  showDayProgress: true,
  showAlarms: true,
  showTimer: true,
  flipSound: true,
  city: 'Jakarta',
  autoTheme: false,
  dateLocale: 'en-US',
  dateFormat: 'long' as 'long' | 'short' | 'iso',
};

function loadSettings(): PersistedSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    // v1 → v2 migration: defaults differ in v2 (showDayProgress, showAlarms added).
    const raw = window.localStorage.getItem(SETTINGS_KEY) ?? window.localStorage.getItem('screensaver.settings.v1');
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PersistedSettings>) };
  } catch {
    return DEFAULTS;
  }
}

export default function App() {
  const initial = loadSettings();

  const [layout, setLayout] = useState<Layout>(initial.layout);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuote, setShowQuote] = useState(initial.showQuote);
  const [showWorldClock, setShowWorldClock] = useState(initial.showWorldClock);
  const [showDate, setShowDate] = useState(initial.showDate);
  const [dateLocale, setDateLocale] = useState<string>(initial.dateLocale);
  const [dateFormat, setDateFormat] = useState<'long' | 'short' | 'iso'>(initial.dateFormat);
  const [showWeather, setShowWeather] = useState(initial.showWeather);
  const [showStopwatch, setShowStopwatch] = useState(initial.showStopwatch);
  const [showPomodoro, setShowPomodoro] = useState(initial.showPomodoro);
  const [showDayProgress, setShowDayProgress] = useState(initial.showDayProgress);
  const [showTimer, setShowTimer] = useState(initial.showTimer);
  const [showAlarms, setShowAlarms] = useState(initial.showAlarms);
  const [autoTheme, setAutoTheme] = useState<boolean>(initial.autoTheme);
  const [theme, setTheme] = useState<ThemeName>(initial.theme);
  // When autoTheme is on, override the user-picked theme based on
  // local hour. We re-evaluate on a 1-minute interval so the watch
  // switches theme around sunrise/sunset without the user lifting
  // a finger. The manual theme picker stays usable in the UI but
  // its effect is masked while autoTheme is on.
  useEffect(() => {
    if (!autoTheme) return;
    const pick = () => {
      const h = new Date().getHours();
      setTheme(h >= 6 && h < 18 ? 'light' : 'dark');
    };
    pick();
    const id = window.setInterval(pick, 60_000);
    return () => window.clearInterval(id);
  }, [autoTheme]);
  const [clockStyle, setClockStyle] = useState<ClockStyle>(initial.clockStyle);
  const [clockColor, setClockColor] = useState<ClockColor>(initial.clockColor);
  const [clockSize, setClockSizeRaw] = useState<ClockSize>(clampClockSize(initial.clockSize));
  // Clamp on every setter so persisted/manual values can't escape the range.
  const setClockSize = useCallback((v: ClockSize) => {
    setClockSizeRaw(clampClockSize(v));
  }, []);
  const adjustClockSize = useCallback((delta: number) => {
    setClockSizeRaw((cur) => clampClockSize((cur as number) + delta));
  }, []);
  const [flipSound, setFlipSound] = useState(initial.flipSound);
  const [city, setCity] = useState<string>(initial.city);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const idleTimer = useRef<number | null>(null);
  const sleep = useSleepTimer();

  // Persist settings to localStorage whenever they change.
  useEffect(() => {
    try {
      const snap: PersistedSettings = {
        layout, theme, clockStyle, clockColor, clockSize,
        showDate, showWorldClock, showQuote, showWeather,
        showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
        flipSound, city, autoTheme, dateLocale, dateFormat,
      };
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(snap));
    } catch {
      // localStorage may be unavailable (private mode, quota); silent fail
    }
  }, [
    layout, theme, clockStyle, clockColor, clockSize,
    showDate, showWorldClock, showQuote, showWeather,
    showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
    flipSound, city, autoTheme, dateLocale, dateFormat,
  ]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen API can throw if not user-initiated; ignore
    }
  }, []);

  // Auto-hide cursor + control buttons
  useEffect(() => {
    const reset = () => {
      if (sleep.isAsleep) return; // never show UI while sleeping
      document.body.style.cursor = 'default';
      setUiVisible(true);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        document.body.style.cursor = 'none';
        setUiVisible(false);
        setShowSettings(false);
      }, 3000);
    };
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('touchstart', reset);
    reset();
    return () => {
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('touchstart', reset);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    };
  }, [sleep.isAsleep]);

  // Sync fullscreen state when user exits via Esc / browser chrome
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Keyboard shortcuts — disabled while typing in inputs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        void toggleFullscreen();
      } else if (k === 's' || k === ',') {
        e.preventDefault();
        setShowSettings((v) => !v);
        setUiVisible(true);
        if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      } else if (k === 'escape') {
        if (sleep.isAsleep) {
          sleep.wake();
        } else {
          setShowSettings(false);
        }
      } else if (k === 'h') {
        // Toggle UI hint — useful when taking screenshots
        setUiVisible((v) => {
          const next = !v;
          document.body.style.cursor = next ? 'default' : 'none';
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen, sleep]);

  const allWidgetsOff =
    !showDate &&
    !showWorldClock &&
    !showQuote &&
    !showWeather &&
    !showStopwatch &&
    !showPomodoro &&
    !showDayProgress &&
    !showAlarms;

  const turnOffAll = () => {
    setShowDate(false);
    setShowWorldClock(false);
    setShowQuote(false);
    setShowWeather(false);
    setShowStopwatch(false);
    setShowPomodoro(false);
    setShowDayProgress(false);
    setShowAlarms(false);
    setShowTimer(false);
  };

  const resetSettings = () => {
    setLayout(DEFAULTS.layout);
    setTheme(DEFAULTS.theme);
    setClockStyle(DEFAULTS.clockStyle);
    setClockColor(DEFAULTS.clockColor);
    setClockSize(DEFAULTS.clockSize);
    setShowDate(DEFAULTS.showDate);
    setDateLocale(DEFAULTS.dateLocale);
    setDateFormat(DEFAULTS.dateFormat);
    setShowWorldClock(DEFAULTS.showWorldClock);
    setShowQuote(DEFAULTS.showQuote);
    setShowWeather(DEFAULTS.showWeather);
    setShowStopwatch(DEFAULTS.showStopwatch);
    setShowPomodoro(DEFAULTS.showPomodoro);
    setShowDayProgress(DEFAULTS.showDayProgress);
    setShowAlarms(DEFAULTS.showAlarms);
    setShowTimer(DEFAULTS.showTimer);
    setFlipSound(DEFAULTS.flipSound);
    setCity(DEFAULTS.city);
    setAutoTheme(DEFAULTS.autoTheme);
  };

  // While asleep, render nothing — black overlay handles the rest.
  if (sleep.isAsleep) {
    return <SleepTimerOverlay show onWake={sleep.wake} />;
  }

  return (
    <div
      className={`min-h-screen w-screen relative overflow-hidden transition-colors duration-500 ${
        isDark(theme)
          ? 'bg-black text-white'
          : isClaude(theme)
          ? 'text-[#3a2e1f]'
          : 'bg-white text-black'
      }`}
      style={
        isClaude(theme)
          ? {
              backgroundColor: '#faf6ef',
              backgroundImage:
                'radial-gradient(at 20% 0%, rgba(217, 119, 87, 0.08) 0px, transparent 50%), radial-gradient(at 80% 100%, rgba(255, 184, 140, 0.10) 0px, transparent 50%)',
            }
          : undefined
      }
    >
      {/* Subtle radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            isDark(theme)
              ? 'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 60%)'
              : isClaude(theme)
              ? 'radial-gradient(ellipse at center, rgba(120, 80, 40, 0.04) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at center, rgba(0,0,0,0.03) 0%, transparent 60%)',
        }}
      />

      {/* Sleep timer chip — top left */}
      <div
        className={`transition-opacity duration-500 ${
          uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <SleepTimerChip handle={sleep} theme={theme} />
      </div>

      {/* Controls — top right, fade on idle */}
      <div
        className={`absolute top-4 right-4 z-20 flex gap-2 transition-opacity duration-500 ${
          uiVisible ? 'opacity-60 hover:opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          className={`p-2 rounded-full transition-colors ${
            isDark(theme) ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
          }`}
          title="Fullscreen (F)"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Toggle settings"
          aria-expanded={showSettings}
          className={`p-2 rounded-full transition-colors ${
            isDark(theme) ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
          }`}
          title="Settings (S)"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Keyboard shortcut hint — bottom center, fades with the rest of the UI. */}
      <div
        className={`absolute bottom-4 left-0 right-0 z-20 flex flex-col items-center gap-2 transition-opacity duration-500 ${
          uiVisible ? 'opacity-50 hover:opacity-80' : 'opacity-0 pointer-events-none'
        }`}
      >
        {clockStyle === 'casio' && (
          <div
            className={`text-[11px] tracking-wider tabular-nums flex items-center gap-3 px-3 py-1 rounded-full backdrop-blur-sm ${
              isDark(theme)
                ? 'bg-white/5 text-white/70'
                : isClaude(theme)
                ? 'bg-[#3a2e1f]/10 text-[#3a2e1f]/70'
                : 'bg-black/5 text-black/70'
            }`}
          >
            <span><kbd className="font-semibold">F</kbd> cycle menu</span>
            <span className="opacity-40">·</span>
            <span><kbd className="font-semibold">Q</kbd> edit / split</span>
            <span className="opacity-40">·</span>
            <span><kbd className="font-semibold">W</kbd>/<kbd className="font-semibold">E</kbd> start · hold 3s for CA510</span>
          </div>
        )}
        <div
          className={`text-[11px] tracking-wider tabular-nums flex items-center gap-3 px-3 py-1.5 rounded-full backdrop-blur-sm ${
            isDark(theme)
              ? 'bg-white/5 text-white/70'
              : isClaude(theme)
              ? 'bg-[#3a2e1f]/10 text-[#3a2e1f]/70'
              : 'bg-black/5 text-black/70'
          }`}
        >
          <span><kbd className="font-semibold">F</kbd> fullscreen</span>
          <span className="opacity-40">·</span>
          <span><kbd className="font-semibold">S</kbd> settings</span>
          <span className="opacity-40">·</span>
          <span><kbd className="font-semibold">H</kbd> hide UI</span>
          <span className="opacity-40">·</span>
          <span><kbd className="font-semibold">Esc</kbd> close / wake</span>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          role="dialog"
          aria-label="Settings"
          className={`absolute top-16 right-4 z-20 backdrop-blur-xl border rounded-2xl p-4 w-72 max-h-[calc(100vh-5rem)] overflow-y-auto ${
            isDark(theme)
              ? 'bg-black/60 border-white/20 text-white'
              : isClaude(theme)
              ? 'bg-[#faf6ef]/95 border-[#d4b896]/40 text-[#3a2e1f] shadow-2xl'
              : 'bg-white/90 border-black/20 text-black shadow-2xl'
          }`}
        >
          <div className="text-xs uppercase tracking-widest opacity-70 mb-3">Layout</div>
          <div className="space-y-1 mb-4">
            {(['classic', 'split', 'minimal'] as Layout[]).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  layout === l
                    ? isDark(theme)
                      ? 'bg-white/15 text-white'
                      : isClaude(theme)
                      ? 'bg-[#e8dcc4] text-[#3a2e1f]'
                      : 'bg-black/15 text-black'
                    : isDark(theme)
                    ? 'hover:bg-white/10 text-white/80'
                    : isClaude(theme)
                    ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                    : 'hover:bg-black/10 text-black/80'
                }`}
              >
                {l === 'classic' && '⏰ Classic'}
                {l === 'split' && '🪟 Split View'}
                {l === 'minimal' && '🌑 Minimal'}
              </button>
            ))}
          </div>

          <div className={`text-xs uppercase tracking-widest opacity-70 mb-3 pt-3 ${isDark(theme) ? 'border-white/15' : isClaude(theme) ? 'border-[#d4b896]/40' : 'border-black/15'}`}>
            Theme
          </div>
          <div className="grid grid-cols-3 gap-1 mb-4">
            {(['dark', 'light', 'claude'] as ThemeName[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-2 py-2 rounded-lg text-xs transition-colors ${
                  theme === t
                    ? isDark(theme)
                      ? 'bg-white/15 text-white'
                      : isClaude(theme)
                      ? 'bg-[#e8dcc4] text-[#3a2e1f]'
                      : 'bg-black/15 text-black'
                    : isDark(theme)
                    ? 'hover:bg-white/10 text-white/80'
                    : isClaude(theme)
                    ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                    : 'hover:bg-black/10 text-black/80'
                }`}
              >
                {t === 'dark' ? '🌑 Dark' : t === 'light' ? '☀️ Light' : '🍂 Claude'}
              </button>
            ))}
          </div>
          <label
            className={`flex items-center justify-between gap-2 mb-4 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${
              isDark(theme)
                ? 'hover:bg-white/5 text-white/80'
                : isClaude(theme)
                ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                : 'hover:bg-black/5 text-black/80'
            }`}
          >
            <span>Auto theme by hour</span>
            <input
              type="checkbox"
              checked={autoTheme}
              onChange={(e) => setAutoTheme(e.target.checked)}
              className="accent-current"
            />
          </label>

          <div className={`text-xs uppercase tracking-widest opacity-70 mb-3 pt-3 ${isDark(theme) ? 'border-white/15' : isClaude(theme) ? 'border-[#d4b896]/40' : 'border-black/15'}`}>
            Clock Style
          </div>
          <div className="grid grid-cols-5 gap-1 mb-4">
            {CLOCK_STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setClockStyle(s)}
                aria-pressed={clockStyle === s}
                className={`px-1 py-2 rounded-lg text-[10px] capitalize transition-colors ${
                  clockStyle === s
                    ? isDark(theme)
                      ? 'bg-white/15 text-white'
                      : isClaude(theme)
                      ? 'bg-[#e8dcc4] text-[#3a2e1f]'
                      : 'bg-black/15 text-black'
                    : isDark(theme)
                    ? 'hover:bg-white/10 text-white/80'
                    : isClaude(theme)
                    ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                    : 'hover:bg-black/10 text-black/80'
                }`}
              >
                {s === 'digital' ? '🔢' : s === 'analog' ? '🕰️' : s === 'retro' ? '📟' : s === 'flip' ? '🔁' : '⌚'}
                <div className="mt-0.5">{s}</div>
              </button>
            ))}
          </div>

          <div className="text-xs uppercase tracking-widest opacity-70 mb-3">
            Clock Size
          </div>
          <div className="flex items-stretch gap-1 mb-4">
            <button
              type="button"
              onClick={() => adjustClockSize(-CLOCK_SIZE_PRESETS.step)}
              disabled={clockSize <= CLOCK_SIZE_PRESETS.min}
              aria-label="Decrease clock size"
              className={`px-2 rounded-lg text-sm transition-colors ${
                clockSize <= CLOCK_SIZE_PRESETS.min
                  ? isDark(theme)
                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                    : isClaude(theme)
                    ? 'bg-[#e8dcc4]/40 text-[#3a2e1f]/30 cursor-not-allowed'
                    : 'bg-black/5 text-black/30 cursor-not-allowed'
                  : isDark(theme)
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : isClaude(theme)
                  ? 'bg-[#e8dcc4] hover:bg-[#f0e6d2] text-[#3a2e1f]'
                  : 'bg-black/10 hover:bg-black/20 text-black'
              }`}
            >
              <Minus className="w-3 h-3" />
            </button>
            <div
              className={`flex-1 flex items-baseline justify-center gap-1 rounded-lg tabular-nums ${
                isDark(theme)
                  ? 'bg-white/10 text-white'
                  : isClaude(theme)
                  ? 'bg-[#e8dcc4] text-[#3a2e1f]'
                  : 'bg-black/10 text-black'
              }`}
            >
              <span className="text-base font-semibold">{(clockSize as number).toFixed(1)}</span>
              <span className="text-[10px] opacity-60">×</span>
            </div>
            <button
              type="button"
              onClick={() => adjustClockSize(CLOCK_SIZE_PRESETS.step)}
              disabled={clockSize >= CLOCK_SIZE_PRESETS.max}
              aria-label="Increase clock size"
              className={`px-2 rounded-lg text-sm transition-colors ${
                clockSize >= CLOCK_SIZE_PRESETS.max
                  ? isDark(theme)
                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                    : isClaude(theme)
                    ? 'bg-[#e8dcc4]/40 text-[#3a2e1f]/30 cursor-not-allowed'
                    : 'bg-black/5 text-black/30 cursor-not-allowed'
                  : isDark(theme)
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : isClaude(theme)
                  ? 'bg-[#e8dcc4] hover:bg-[#f0e6d2] text-[#3a2e1f]'
                  : 'bg-black/10 hover:bg-black/20 text-black'
              }`}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1 mb-4 -mt-2">
            {CLOCK_SIZES.map((sz) => (
              <button
                key={sz.label}
                onClick={() => setClockSize(sz.scale)}
                aria-pressed={Math.abs((clockSize as number) - sz.scale) < 0.05}
                className={`px-1 py-1.5 rounded-lg text-[10px] transition-colors ${
                  Math.abs((clockSize as number) - sz.scale) < 0.05
                    ? isDark(theme)
                      ? 'bg-white/15 text-white'
                      : isClaude(theme)
                      ? 'bg-[#d6c8a8] text-[#3a2e1f]'
                      : 'bg-black/15 text-black'
                    : isDark(theme)
                    ? 'hover:bg-white/10 text-white/70'
                    : isClaude(theme)
                    ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/70'
                    : 'hover:bg-black/10 text-black/70'
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>

          <div className="text-xs uppercase tracking-widest opacity-70 mb-3">
            Clock Color
          </div>
          <div className="grid grid-cols-3 gap-1 mb-1">
            {CLOCK_COLORS.map((c) => {
              // Contrast hint: if user picks white on light theme, or ink on
              // dark theme, the digits will be invisible. Don't block the
              // choice — let the user see the result and decide.
              const poorContrast =
                (c.id === 'white' && theme !== 'dark') ||
                (c.id === 'ink' && theme === 'dark');
              return (
                <button
                  key={c.id}
                  onClick={() => setClockColor(c.id)}
                  aria-pressed={clockColor === c.id}
                  title={poorContrast ? 'May be hard to read on this theme' : undefined}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors ${
                    clockColor === c.id
                      ? isDark(theme)
                        ? 'bg-white/15 text-white'
                        : isClaude(theme)
                        ? 'bg-[#e8dcc4] text-[#3a2e1f]'
                        : 'bg-black/15 text-black'
                      : isDark(theme)
                      ? 'hover:bg-white/10 text-white/80'
                      : isClaude(theme)
                      ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                      : 'hover:bg-black/10 text-black/80'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.hex, boxShadow: `0 0 8px ${c.hex}` }}
                  />
                  <span className="truncate">{c.label}</span>
                  {poorContrast && (
                    <span className="ml-auto text-[10px] opacity-60" aria-hidden>⚠</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className={`text-[10px] opacity-50 mb-4 ${isDark(theme) ? 'text-white' : 'text-black'}`}>
            ⚠ = may be hard to read on this theme
          </div>

          <div className="text-xs uppercase tracking-widest opacity-70 mb-3">
            Weather City
          </div>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Jakarta, Tokyo, London…"
            className={`w-full px-3 py-2 rounded-lg text-sm mb-4 outline-none ${
              isDark(theme)
                ? 'bg-white/10 text-white placeholder-white/40 focus:bg-white/15'
                : isClaude(theme)
                ? 'bg-[#f0e6d2] text-[#3a2e1f] placeholder-[#3a2e1f]/40 focus:bg-[#e8dcc4]'
                : 'bg-black/5 text-black placeholder-black/40 focus:bg-black/10'
            }`}
          />

          <div className={`text-xs uppercase tracking-widest opacity-70 mb-3 pt-3 ${isDark(theme) ? 'border-white/15' : isClaude(theme) ? 'border-[#d4b896]/40' : 'border-black/15'}`}>
            Visibility
          </div>
          <div className="flex gap-1 mb-3">
            <button
              type="button"
              onClick={turnOffAll}
              disabled={allWidgetsOff}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                isDark(theme)
                  ? 'bg-white/5 hover:bg-white/15 disabled:bg-white/5 disabled:opacity-40'
                  : isClaude(theme)
                  ? 'bg-[#e8dcc4]/40 hover:bg-[#e8dcc4] disabled:bg-[#e8dcc4]/20 disabled:opacity-40 text-[#3a2e1f]'
                  : 'bg-black/5 hover:bg-black/15 disabled:bg-black/5 disabled:opacity-40'
              }`}
            >
              {allWidgetsOff ? 'All Off' : 'Turn Off All'}
            </button>
            <button
              type="button"
              onClick={resetSettings}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                isDark(theme)
                  ? 'bg-white/5 hover:bg-white/15 text-white/80'
                  : isClaude(theme)
                  ? 'bg-[#e8dcc4]/40 hover:bg-[#e8dcc4] text-[#3a2e1f]/80'
                  : 'bg-black/5 hover:bg-black/15 text-black/80'
              }`}
            >
              Reset
            </button>
          </div>
          <div className="space-y-1">
            {[
              { label: 'Date', val: showDate, set: () => setShowDate((v) => !v) },
              { label: 'World Clock', val: showWorldClock, set: () => setShowWorldClock((v) => !v) },
              { label: 'Quotes', val: showQuote, set: () => setShowQuote((v) => !v) },
              { label: 'Pomodoro', val: showPomodoro, set: () => setShowPomodoro((v) => !v) },
              { label: 'Stopwatch', val: showStopwatch, set: () => setShowStopwatch((v) => !v) },
              { label: 'Timer', val: showTimer, set: () => setShowTimer((v) => !v) },
              { label: 'Weather', val: showWeather, set: () => setShowWeather((v) => !v) },
              { label: 'Day Progress', val: showDayProgress, set: () => setShowDayProgress((v) => !v) },
              { label: 'Alarms', val: showAlarms, set: () => setShowAlarms((v) => !v) },
              { label: 'Flip Sound', val: flipSound, set: () => setFlipSound((v) => !v) },
            ].map((opt) => (
              <label
                key={opt.label}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${
                  isDark(theme)
                    ? 'hover:bg-white/10'
                    : isClaude(theme)
                    ? 'hover:bg-[#f0e6d2]'
                    : 'hover:bg-black/10'
                }`}
              >
                <span className="text-sm font-medium">{opt.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={opt.val}
                  onClick={opt.set}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    opt.val
                      ? isDark(theme)
                        ? 'bg-white/50'
                        : isClaude(theme)
                        ? 'bg-[#a87a4a]'
                        : 'bg-black/60'
                      : isDark(theme)
                      ? 'bg-white/15'
                      : isClaude(theme)
                      ? 'bg-[#d4b896]/50'
                      : 'bg-black/20'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full transition-transform bg-white ${
                      opt.val ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>

          {showDate && (
            <div
              className={`mt-3 space-y-2 text-[10px] ${
                isDark(theme) ? 'text-white/60' : isClaude(theme) ? 'text-[#3a2e1f]/60' : 'text-black/60'
              }`}
            >
              <div className="flex gap-1">
                {(['en-US', 'id-ID'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setDateLocale(loc)}
                    aria-pressed={dateLocale === loc}
                    className={`flex-1 px-2 py-1 rounded text-[10px] transition-colors ${
                      dateLocale === loc
                        ? isDark(theme)
                          ? 'bg-white/15 text-white'
                          : isClaude(theme)
                          ? 'bg-[#d4b896] text-[#3a2e1f]'
                          : 'bg-black/15 text-black'
                        : isDark(theme)
                        ? 'hover:bg-white/10 text-white/70'
                        : isClaude(theme)
                        ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/70'
                        : 'hover:bg-black/10 text-black/70'
                    }`}
                  >
                    {loc === 'en-US' ? 'EN' : 'ID'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['long', 'short', 'iso'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDateFormat(f)}
                    aria-pressed={dateFormat === f}
                    className={`flex-1 px-2 py-1 rounded text-[10px] transition-colors ${
                      dateFormat === f
                        ? isDark(theme)
                          ? 'bg-white/15 text-white'
                          : isClaude(theme)
                          ? 'bg-[#d4b896] text-[#3a2e1f]'
                          : 'bg-black/15 text-black'
                        : isDark(theme)
                        ? 'hover:bg-white/10 text-white/70'
                        : isClaude(theme)
                        ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/70'
                        : 'hover:bg-black/10 text-black/70'
                    }`}
                  >
                    {f === 'long' ? 'Long' : f === 'short' ? 'Short' : 'ISO'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={`text-[10px] mt-4 opacity-40 leading-relaxed ${isDark(theme) ? 'text-white' : 'text-black'}`}>
            Shortcuts: <kbd className="px-1 border border-current/30 rounded">F</kbd> fullscreen ·{' '}
            <kbd className="px-1 border border-current/30 rounded">S</kbd> settings ·{' '}
            <kbd className="px-1 border border-current/30 rounded">H</kbd> hide UI ·{' '}
            <kbd className="px-1 border border-current/30 rounded">Esc</kbd> close/wake
          </div>

          {/* Settings export / import — sync current config between machines. */}
          <div className={`text-xs uppercase tracking-widest opacity-70 mb-3 pt-3 ${isDark(theme) ? 'border-white/15' : isClaude(theme) ? 'border-[#d4b896]/40' : 'border-black/15'}`}>
            Backup
          </div>
          <div className="flex gap-1 mb-3">
            <button
              type="button"
              onClick={() => {
                try {
                  const raw = window.localStorage.getItem(SETTINGS_KEY) ?? '{}';
                  const blob = new Blob([raw], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `screensaver-settings-${new Date().toISOString().slice(0, 10)}.json`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch {
                  // ignore
                }
              }}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                isDark(theme)
                  ? 'bg-white/5 hover:bg-white/15 text-white'
                  : isClaude(theme)
                  ? 'bg-[#e8dcc4] hover:bg-[#d4b896] text-[#3a2e1f]'
                  : 'bg-black/5 hover:bg-black/15 text-black'
              }`}
            >
              Export
            </button>
            <label
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs text-center transition-colors cursor-pointer ${
                isDark(theme)
                  ? 'bg-white/5 hover:bg-white/15 text-white'
                  : isClaude(theme)
                  ? 'bg-[#e8dcc4] hover:bg-[#d4b896] text-[#3a2e1f]'
                  : 'bg-black/5 hover:bg-black/15 text-black'
              }`}
            >
              Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const text = String(reader.result);
                      // Sanity-check: must be a JSON object with a layout
                      // field (our settings always have one).
                      const parsed = JSON.parse(text);
                      if (typeof parsed !== 'object' || parsed === null || !('layout' in parsed)) {
                        throw new Error('not a settings file');
                      }
                      window.localStorage.setItem(SETTINGS_KEY, text);
                      // Reload to apply.
                      window.location.reload();
                    } catch {
                      // ignore — bad file
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Layouts */}
      {layout === 'classic' && (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 gap-8">
          <DigitalClock style={clockStyle} color={clockColor} size={clockSize} soundEnabled={flipSound} theme={theme} />
          {showDate && <DateDisplay theme={theme} locale={dateLocale} format={dateFormat} />}
          {showWorldClock && <WorldClock color={clockColor} theme={theme} />}

          {(showPomodoro || showStopwatch || showDayProgress || showTimer) && (
            <div className="flex flex-wrap items-start justify-center gap-12 mt-2">
              {showPomodoro && <Pomodoro theme={theme} />}
              {showStopwatch && <Stopwatch theme={theme} />}
              {showTimer && <Timer theme={theme} />}
              {showDayProgress && <DayProgress theme={theme} city={city} />}
            </div>
          )}

          {(showWeather || showQuote || showAlarms) && (
            <div className="flex flex-col items-center gap-4 mt-2 w-full max-w-md">
              {showWeather && <Weather theme={theme} city={city} />}
              {showQuote && <Quotes theme={theme} />}
              {showAlarms && <AlarmList theme={theme} />}
            </div>
          )}
        </div>
      )}

      {layout === 'split' && (
        <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-3 gap-6 p-12">
          {/* Left: time */}
          <div className="flex flex-col items-center justify-center gap-6 border-r border-white/10 pr-6">
            <DigitalClock style={clockStyle} color={clockColor} size={clockSize} soundEnabled={flipSound} theme={theme} />
            {showDate && <DateDisplay theme={theme} locale={dateLocale} format={dateFormat} />}
            {showWorldClock && <WorldClock color={clockColor} theme={theme} />}
            {showDayProgress && <DayProgress theme={theme} city={city} />}
          </div>

          {/* Center: tools */}
          <div className="flex flex-col items-center justify-center gap-8 border-r border-white/10 pr-6">
            {showPomodoro && <Pomodoro theme={theme} />}
            {showStopwatch && <Stopwatch theme={theme} />}
            {showTimer && <Timer theme={theme} />}
            {showAlarms && <AlarmList theme={theme} />}
          </div>

          {/* Right: info */}
          <div className="flex flex-col items-start justify-center gap-6">
            {showWeather && <Weather theme={theme} city={city} />}
            {showQuote && <Quotes theme={theme} />}
          </div>
        </div>
      )}

      {layout === 'minimal' && (
        <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
          <DigitalClock style={clockStyle} color={clockColor} size={clockSize} soundEnabled={flipSound} theme={theme} />
        </div>
      )}
    </div>
  );
}
