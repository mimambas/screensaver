// App.tsx — top-level orchestrator. Owns the persisted-settings state
// + the lifecycle effects (autoTheme, fullscreen, idle, PWA mode).
// Everything else — settings panel, layouts, widgets — reads from
// `useSettings()`. This file is intentionally short; the body
// background, vignette, and wallpaper layer are all that's left
// in JSX besides the layouts and chrome.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Maximize2, Minimize2, Settings } from 'lucide-react';
import {
  CLOCK_SIZE_PRESETS,
  clampClockSize,
  type ClockColor,
  type ClockSize,
  type ClockStyle,
  type ThemeName,
} from './widgets/clock-constants';
import { THEMES } from './widgets/theme-presets';
import { useSleepTimer } from './widgets/use-sleep-timer';
import { SleepTimerOverlay, SleepTimerChip } from './widgets/SleepTimer';
import { Wallpaper } from './widgets/Wallpaper';
import { useWorldCities } from './widgets/use-world-cities';
import { useAmbient } from './widgets/Ambient';
import { useT, useLocale } from './i18n';
import {
  SettingsContext,
  type SettingsContextValue,
  type Layout,
  type WallpaperId,
  type AmbientId,
} from './widgets/settings-context';
import { isDark, isClaude } from './widgets/theme-helpers';
import { SettingsPanel } from './widgets/SettingsPanel';
import { LayoutClassic } from './widgets/LayoutClassic';
import { LayoutSplit } from './widgets/LayoutSplit';
import { LayoutMinimal } from './widgets/LayoutMinimal';

const SETTINGS_KEY = 'screensaver.settings.v2';

type PersistedSettings = Omit<
  SettingsContextValue,
  | keyof import('./widgets/settings-context').SettingsActions
  | 'worldCities'
  | 'locale'
  | 'setLocale'
  | 'setLayout'
  | 'setTheme'
  | 'setAutoTheme'
  | 'setWallpaper'
  | 'setWallpaperIntensity'
  | 'setAmbient'
  | 'setAmbientVolume'
  | 'setClockStyle'
  | 'setClockColor'
  | 'setCustomColor'
  | 'setClockSize'
  | 'adjustClockSize'
  | 'setFlipSound'
  | 'setCity'
  | 'setDateLocale'
  | 'setDateFormat'
  | 'setAutoLaunch'
  | 'setAutoLaunchMs'
  | 'setShowDate'
  | 'setShowCalendar'
  | 'setShowWorldClock'
  | 'setShowQuote'
  | 'setShowWeather'
  | 'setShowStopwatch'
  | 'setShowPomodoro'
  | 'setShowDayProgress'
  | 'setShowAlarms'
  | 'setShowTimer'
  | 'setShowBreathing'
  | 'setShowAffirmation'
  | 'toggleShow'
  | 'turnOffAll'
  | 'resetToDefaults'
>;

const DEFAULTS: PersistedSettings = {
  layout: 'classic',
  theme: 'dark',
  autoTheme: false,
  wallpaper: 'aurora',
  wallpaperIntensity: 0.4,
  ambient: 'none',
  ambientVolume: 0.3,
  clockStyle: 'digital',
  clockColor: 'white',
  customColor: '#a78bfa',
  clockSize: CLOCK_SIZE_PRESETS.default,
  flipSound: true,
  city: 'Jakarta',
  dateLocale: 'en-US',
  dateFormat: 'long',
  autoLaunch: false,
  autoLaunchMs: 5 * 60_000,
  showDate: true,
  showCalendar: false,
  showWorldClock: true,
  showQuote: true,
  showWeather: true,
  showStopwatch: true,
  showPomodoro: true,
  showDayProgress: true,
  showAlarms: true,
  showTimer: true,
  showBreathing: false,
  showAffirmation: false,
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
  // ── Persisted state (the only useState calls in this file) ──────
  const [layout, setLayout] = useState<Layout>(initial.layout);
  const [theme, setTheme] = useState<ThemeName>(initial.theme);
  const [autoTheme, setAutoTheme] = useState<boolean>(initial.autoTheme);
  const [wallpaper, setWallpaper] = useState<WallpaperId>(initial.wallpaper);
  const [wallpaperIntensity, setWallpaperIntensity] = useState<number>(initial.wallpaperIntensity);
  const [ambient, setAmbient] = useState<AmbientId>(initial.ambient);
  const [ambientVolume, setAmbientVolume] = useState<number>(initial.ambientVolume);
  const [clockStyle, setClockStyle] = useState<ClockStyle>(initial.clockStyle);
  const [clockColor, setClockColor] = useState<ClockColor>(initial.clockColor);
  const [customColor, setCustomColor] = useState<string>(initial.customColor);
  const [clockSize, setClockSizeRaw] = useState<ClockSize>(clampClockSize(initial.clockSize));
  const setClockSize = useCallback((v: ClockSize) => {
    setClockSizeRaw(clampClockSize(v));
  }, []);
  const adjustClockSize = useCallback((delta: number) => {
    setClockSizeRaw((cur) => clampClockSize((cur as number) + delta));
  }, []);
  const [flipSound, setFlipSound] = useState(initial.flipSound);
  const [city, setCity] = useState<string>(initial.city);
  const [dateLocale, setDateLocale] = useState<string>(initial.dateLocale);
  const [dateFormat, setDateFormat] = useState<'long' | 'short' | 'iso'>(initial.dateFormat);
  const [autoLaunch, setAutoLaunch] = useState<boolean>(initial.autoLaunch);
  const [autoLaunchMs, setAutoLaunchMs] = useState<number>(initial.autoLaunchMs);
  const [showDate, setShowDate] = useState(initial.showDate);
  const [showCalendar, setShowCalendar] = useState(initial.showCalendar);
  const [showWorldClock, setShowWorldClock] = useState(initial.showWorldClock);
  const [showQuote, setShowQuote] = useState(initial.showQuote);
  const [showWeather, setShowWeather] = useState(initial.showWeather);
  const [showStopwatch, setShowStopwatch] = useState(initial.showStopwatch);
  const [showPomodoro, setShowPomodoro] = useState(initial.showPomodoro);
  const [showDayProgress, setShowDayProgress] = useState(initial.showDayProgress);
  const [showAlarms, setShowAlarms] = useState(initial.showAlarms);
  const [showTimer, setShowTimer] = useState(initial.showTimer);
  const [showBreathing, setShowBreathing] = useState(initial.showBreathing);
  const [showAffirmation, setShowAffirmation] = useState(initial.showAffirmation);

  // ── Non-persisted UI state ──────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // When launched as an installed PWA the browser chrome is already
  // gone — fullscreen toggle is a no-op. Detect via display-mode
  // media query (true on iOS home-screen launches and Android TWA).
  const [isStandalone, setIsStandalone] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  const t = useT();
  const [locale, setLocale] = useLocale();
  const worldCities = useWorldCities();
  const idleTimer = useRef<number | null>(null);
  const autoLaunchTimer = useRef<number | null>(null);
  const sleep = useSleepTimer();

  // ── Aggregate bulk actions (memoized so identity is stable) ────
  const turnOffAll = useCallback(() => {
    setShowDate(false);
    setShowCalendar(false);
    setShowWorldClock(false);
    setShowQuote(false);
    setShowWeather(false);
    setShowStopwatch(false);
    setShowPomodoro(false);
    setShowDayProgress(false);
    setShowAlarms(false);
    setShowTimer(false);
    setShowBreathing(false);
    setShowAffirmation(false);
  }, []);

  const resetToDefaults = useCallback(() => {
    setLayout(DEFAULTS.layout);
    setTheme(DEFAULTS.theme);
    setAutoTheme(DEFAULTS.autoTheme);
    setWallpaper(DEFAULTS.wallpaper);
    setWallpaperIntensity(DEFAULTS.wallpaperIntensity);
    setAmbient(DEFAULTS.ambient);
    setAmbientVolume(DEFAULTS.ambientVolume);
    setClockStyle(DEFAULTS.clockStyle);
    setClockColor(DEFAULTS.clockColor);
    setCustomColor(DEFAULTS.customColor);
    setClockSize(DEFAULTS.clockSize);
    setFlipSound(DEFAULTS.flipSound);
    setCity(DEFAULTS.city);
    setDateLocale(DEFAULTS.dateLocale);
    setDateFormat(DEFAULTS.dateFormat);
    setAutoLaunch(DEFAULTS.autoLaunch);
    setAutoLaunchMs(DEFAULTS.autoLaunchMs);
    setShowDate(DEFAULTS.showDate);
    setShowCalendar(DEFAULTS.showCalendar);
    setShowWorldClock(DEFAULTS.showWorldClock);
    setShowQuote(DEFAULTS.showQuote);
    setShowWeather(DEFAULTS.showWeather);
    setShowStopwatch(DEFAULTS.showStopwatch);
    setShowPomodoro(DEFAULTS.showPomodoro);
    setShowDayProgress(DEFAULTS.showDayProgress);
    setShowAlarms(DEFAULTS.showAlarms);
    setShowTimer(DEFAULTS.showTimer);
    setShowBreathing(DEFAULTS.showBreathing);
    setShowAffirmation(DEFAULTS.showAffirmation);
  // setClockSize is intentionally excluded — it only forwards to
  // setClockSizeRaw and would just add noise to the deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Context value (stable references where possible) ────────────
  const ctxValue = useMemo<SettingsContextValue>(() => ({
    layout, theme, autoTheme,
    wallpaper, wallpaperIntensity, ambient, ambientVolume,
    clockStyle, clockColor, customColor, clockSize, flipSound,
    city, dateLocale, dateFormat, autoLaunch, autoLaunchMs,
    showDate, showCalendar, showWorldClock, showQuote, showWeather,
    showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
    showBreathing, showAffirmation,
    worldCities,
    locale,
    setLocale,
    setLayout, setTheme, setAutoTheme,
    setWallpaper, setWallpaperIntensity, setAmbient, setAmbientVolume,
    setClockStyle, setClockColor, setCustomColor, setClockSize, adjustClockSize,
    setFlipSound, setCity, setDateLocale, setDateFormat, setAutoLaunch, setAutoLaunchMs,
    setShowDate, setShowCalendar, setShowWorldClock, setShowQuote, setShowWeather,
    setShowStopwatch, setShowPomodoro, setShowDayProgress, setShowAlarms, setShowTimer,
    setShowBreathing, setShowAffirmation,
    toggleShow: () => {},
    turnOffAll,
    resetToDefaults,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    layout, theme, autoTheme,
    wallpaper, wallpaperIntensity, ambient, ambientVolume,
    clockStyle, clockColor, customColor, clockSize, flipSound,
    city, dateLocale, dateFormat, autoLaunch, autoLaunchMs,
    showDate, showCalendar, showWorldClock, showQuote, showWeather,
    showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
    showBreathing, showAffirmation,
    worldCities, locale, turnOffAll, resetToDefaults,
  ]);

  // ── Persist to localStorage whenever settings change ────────────
  useEffect(() => {
    try {
      const snap: PersistedSettings = {
        layout, theme, autoTheme,
        wallpaper, wallpaperIntensity, ambient, ambientVolume,
        clockStyle, clockColor, customColor, clockSize, flipSound,
        city, dateLocale, dateFormat, autoLaunch, autoLaunchMs,
        showDate, showCalendar, showWorldClock, showQuote, showWeather,
        showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
        showBreathing, showAffirmation,
      };
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(snap));
    } catch {
      // localStorage may be unavailable (private mode, quota); silent fail
    }
  }, [
    layout, theme, autoTheme,
    wallpaper, wallpaperIntensity, ambient, ambientVolume,
    clockStyle, clockColor, customColor, clockSize, flipSound,
    city, dateLocale, dateFormat, autoLaunch, autoLaunchMs,
    showDate, showCalendar, showWorldClock, showQuote, showWeather,
    showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
    showBreathing, showAffirmation,
  ]);

  // ── Auto-theme: switch to light/dark based on local hour ────────
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

  // ── Fullscreen toggle ───────────────────────────────────────────
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

  // Sync fullscreen state when user exits via Esc / browser chrome.
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Detect installed-PWA mode. Updates live if the user installs
  // while the tab is open.
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const update = () => setIsStandalone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // ── Auto-hide cursor + control buttons after 3s idle ────────────
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
        // Auto-launch into fullscreen after a longer idle if the user
        // opted in. This is the actual screensaver behavior: the screen
        // goes fullscreen on its own, wakes on any input.
        if (autoLaunch && !document.fullscreenElement) {
          autoLaunchTimer.current = window.setTimeout(() => {
            if (autoLaunch && !document.fullscreenElement) {
              void toggleFullscreen();
            }
          }, autoLaunchMs);
        }
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
      if (autoLaunchTimer.current !== null) window.clearTimeout(autoLaunchTimer.current);
    };
  }, [sleep.isAsleep, autoLaunch, autoLaunchMs, toggleFullscreen]);

  // ── Keyboard shortcuts — disabled while typing in inputs ────────
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

  // Drive ambient sound engine. Renders nothing. Called before any
  // early returns (hooks rules).
  useAmbient(ambient, ambientVolume);

  // While asleep, render nothing — black overlay handles the rest.
  if (sleep.isAsleep) {
    return <SleepTimerOverlay show onWake={sleep.wake} />;
  }

  const palette = THEMES[theme];

  return (
    <SettingsContext.Provider value={ctxValue}>
      <div
        className={`min-h-screen w-screen relative overflow-hidden transition-[background-color,color] duration-700 ${palette.bodyClass}`}
        style={
          palette.bgColor
            ? {
                backgroundColor: palette.bgColor,
                backgroundImage: palette.bgImage,
                transition: palette.bgTransition,
              }
            : { transition: palette.bgTransition }
        }
      >
        {/* Subtle radial vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: palette.vignette }}
        />

        {/* Animated wallpaper layer */}
        {wallpaper !== 'none' && (
          <Wallpaper
            style={wallpaper}
            intensity={wallpaperIntensity}
            isDark={isDark(theme)}
          />
        )}

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
            aria-label={t('control.toggleFullscreen')}
            disabled={isStandalone}
            className={`p-2 rounded-full transition-colors ${
              isStandalone
                ? 'opacity-30 cursor-default'
                : isDark(theme)
                ? 'bg-white/5 hover:bg-white/10'
                : 'bg-black/5 hover:bg-black/10'
            }`}
            title={isStandalone ? t('control.fullscreenPwa') : t('control.fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            aria-label={t('control.toggleSettings')}
            aria-expanded={showSettings}
            className={`p-2 rounded-full transition-colors ${
              isDark(theme) ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
            }`}
            title={t('control.settings')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Keyboard shortcut hint — bottom center, fades with the rest of the UI. */}
        <div
          data-hint="shortcut-pill"
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
            <span><kbd className="font-semibold">F</kbd> {t('shortcuts.hint.fullscreen')}</span>
            <span className="opacity-40">·</span>
            <span><kbd className="font-semibold">S</kbd> {t('shortcuts.hint.settings')}</span>
            <span className="opacity-40">·</span>
            <span><kbd className="font-semibold">H</kbd> {t('shortcuts.hint.hideUI')}</span>
            <span className="opacity-40">·</span>
            <span><kbd className="font-semibold">Esc</kbd> {t('shortcuts.hint.closeWake')}</span>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && <SettingsPanel />}

        {/* Active layout */}
        {layout === 'classic' && <LayoutClassic />}
        {layout === 'split' && <LayoutSplit />}
        {layout === 'minimal' && <LayoutMinimal />}
      </div>
    </SettingsContext.Provider>
  );
}
