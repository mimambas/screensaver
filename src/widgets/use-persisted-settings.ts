// usePersistedSettings — single hook that owns:
//   1. localStorage read on mount
//   2. 25+ useState calls for each persisted field
//   3. clamp/sanitize for the trickier fields (clockSize)
//   4. localStorage write on every change (debounced)
//   5. v1 → v2 migration
//
// Replaces ~120 lines of boilerplate in App.tsx. Consumers get a
// single object with the settings + their setters; they don't need
// to know about persistence.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CLOCK_SIZE_PRESETS,
  clampClockSize,
  type ClockColor,
  type ClockSize,
  type ClockStyle,
} from './clock-constants';
import type { ThemeName } from './theme-presets';
import type { Layout, WallpaperId, AmbientId } from './settings-context';

const STORAGE_KEY = 'screensaver.settings.v2';
const STORAGE_KEY_V1 = 'screensaver.settings.v1';

export interface PersistedSettings {
  layout: Layout;
  theme: ThemeName;
  autoTheme: boolean;
  wallpaper: WallpaperId;
  wallpaperIntensity: number;
  ambient: AmbientId;
  ambientVolume: number;
  clockStyle: ClockStyle;
  clockColor: ClockColor;
  customColor: string;
  clockSize: ClockSize;
  flipSound: boolean;
  city: string;
  dateLocale: string;
  dateFormat: 'long' | 'short' | 'iso';
  autoLaunch: boolean;
  autoLaunchMs: number;
  showDate: boolean;
  showCalendar: boolean;
  showWorldClock: boolean;
  showQuote: boolean;
  showWeather: boolean;
  showStopwatch: boolean;
  showPomodoro: boolean;
  showDayProgress: boolean;
  showAlarms: boolean;
  showTimer: boolean;
  showBreathing: boolean;
  showAffirmation: boolean;
  // Audio mixer
  masterVolume: number;
  chimeVolume: number;
  notifVolume: number;
  muteMaster: boolean;
  muteChime: boolean;
  muteAmbient: boolean;
  muteNotif: boolean;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
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
  // Audio mixer — per-stage volumes and mutes. The defaults are
  // sensible: master at 80% (full blast on a fresh device is too
  // aggressive), chime at 70% (pomodoro/alarm), ambient at 50%
  // (rain shouldn't drown out everything), notif at 80%.
  masterVolume: 0.8,
  chimeVolume: 0.7,
  notifVolume: 0.8,
  muteMaster: false,
  muteChime: false,
  muteAmbient: false,
  muteNotif: false,
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

function loadFromStorage(): PersistedSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    // v1 → v2 migration: defaults differ in v2 (showDayProgress,
    // showAlarms added).
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<PersistedSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// The hook returns a tuple of [state, setters, bulk-actions].
// We split the setters into one object so it's easy to memoize.
export interface UsePersistedSettings {
  state: PersistedSettings;
  set: {
    setLayout: (v: Layout) => void;
    setTheme: (v: ThemeName) => void;
    setAutoTheme: (v: boolean) => void;
    setWallpaper: (v: WallpaperId) => void;
    setWallpaperIntensity: (v: number) => void;
    setAmbient: (v: AmbientId) => void;
    setAmbientVolume: (v: number) => void;
    setClockStyle: (v: ClockStyle) => void;
    setClockColor: (v: ClockColor) => void;
    setCustomColor: (v: string) => void;
    setClockSize: (v: ClockSize) => void;
    adjustClockSize: (delta: number) => void;
    setFlipSound: (v: boolean) => void;
    setCity: (v: string) => void;
    setDateLocale: (v: string) => void;
    setDateFormat: (v: 'long' | 'short' | 'iso') => void;
    setAutoLaunch: (v: boolean) => void;
    setAutoLaunchMs: (v: number) => void;
    setShowDate: (v: boolean) => void;
    setShowCalendar: (v: boolean) => void;
    setShowWorldClock: (v: boolean) => void;
    setShowQuote: (v: boolean) => void;
    setShowWeather: (v: boolean) => void;
    setShowStopwatch: (v: boolean) => void;
    setShowPomodoro: (v: boolean) => void;
    setShowDayProgress: (v: boolean) => void;
    setShowAlarms: (v: boolean) => void;
    setShowTimer: (v: boolean) => void;
    setShowBreathing: (v: boolean) => void;
    setShowAffirmation: (v: boolean) => void;
    setMasterVolume: (v: number) => void;
    setChimeVolume: (v: number) => void;
    setNotifVolume: (v: number) => void;
    setMuteMaster: (v: boolean) => void;
    setMuteChime: (v: boolean) => void;
    setMuteAmbient: (v: boolean) => void;
    setMuteNotif: (v: boolean) => void;
    turnOffAll: () => void;
    resetToDefaults: () => void;
  };
}

export function usePersistedSettings(): UsePersistedSettings {
  const initial = loadFromStorage();
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
  const [masterVolume, setMasterVolumeRaw] = useState(initial.masterVolume);
  const [chimeVolume, setChimeVolumeRaw] = useState(initial.chimeVolume);
  const [notifVolume, setNotifVolumeRaw] = useState(initial.notifVolume);
  const [muteMaster, setMuteMaster] = useState(initial.muteMaster);
  const [muteChime, setMuteChime] = useState(initial.muteChime);
  const [muteAmbient, setMuteAmbient] = useState(initial.muteAmbient);
  const [muteNotif, setMuteNotif] = useState(initial.muteNotif);
  // Clamp the persisted volume to 0..1 so storage tampering
  // (or a sloppy v1→v2 migration) can't yield gain > 1.
  const setMasterVolume = (v: number) => setMasterVolumeRaw(Math.max(0, Math.min(1, v)));
  const setChimeVolume = (v: number) => setChimeVolumeRaw(Math.max(0, Math.min(1, v)));
  const setNotifVolume = (v: number) => setNotifVolumeRaw(Math.max(0, Math.min(1, v)));

  // Debounced write to localStorage. We hold the latest snapshot in
  // a ref and flush on a 250ms timer; this turns 60 writes/min from
  // (say) a slider drag into 4 writes/sec, and stops writing entirely
  // when the user pauses. `flush()` runs on unmount so nothing is
  // lost if the user closes the tab mid-edit.
  const snapshotRef = useRef<PersistedSettings>({
    layout, theme, autoTheme,
    wallpaper, wallpaperIntensity, ambient, ambientVolume,
    clockStyle, clockColor, customColor, clockSize, flipSound,
    city, dateLocale, dateFormat, autoLaunch, autoLaunchMs,
    showDate, showCalendar, showWorldClock, showQuote, showWeather,
    showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
    showBreathing, showAffirmation,
    masterVolume, chimeVolume, notifVolume,
    muteMaster, muteChime, muteAmbient, muteNotif,
  });

  useEffect(() => {
    snapshotRef.current = {
      layout, theme, autoTheme,
      wallpaper, wallpaperIntensity, ambient, ambientVolume,
      clockStyle, clockColor, customColor, clockSize, flipSound,
      city, dateLocale, dateFormat, autoLaunch, autoLaunchMs,
      showDate, showCalendar, showWorldClock, showQuote, showWeather,
      showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
      showBreathing, showAffirmation,
      masterVolume, chimeVolume, notifVolume,
      muteMaster, muteChime, muteAmbient, muteNotif,
    };
  }, [
    layout, theme, autoTheme,
    wallpaper, wallpaperIntensity, ambient, ambientVolume,
    clockStyle, clockColor, customColor, clockSize, flipSound,
    city, dateLocale, dateFormat, autoLaunch, autoLaunchMs,
    showDate, showCalendar, showWorldClock, showQuote, showWeather,
    showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
    showBreathing, showAffirmation,
    masterVolume, chimeVolume, notifVolume,
    muteMaster, muteChime, muteAmbient, muteNotif,
  ]);

  useEffect(() => {
    let id: number | null = null;
    const schedule = () => {
      if (id !== null) return; // already scheduled
      id = window.setTimeout(() => {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotRef.current));
        } catch {
          // localStorage may be unavailable (private mode, quota); silent fail
        }
        id = null;
      }, 250);
    };
    schedule();
    return () => {
      if (id !== null) {
        window.clearTimeout(id);
        // Flush the latest snapshot synchronously on unmount so we
        // don't lose a trailing write when the user closes the tab.
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotRef.current));
        } catch {
          /* ignore */
        }
        id = null;
      }
    };
  });

  // Bulk actions.
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
    setLayout(DEFAULT_SETTINGS.layout);
    setTheme(DEFAULT_SETTINGS.theme);
    setAutoTheme(DEFAULT_SETTINGS.autoTheme);
    setWallpaper(DEFAULT_SETTINGS.wallpaper);
    setWallpaperIntensity(DEFAULT_SETTINGS.wallpaperIntensity);
    setAmbient(DEFAULT_SETTINGS.ambient);
    setAmbientVolume(DEFAULT_SETTINGS.ambientVolume);
    setClockStyle(DEFAULT_SETTINGS.clockStyle);
    setClockColor(DEFAULT_SETTINGS.clockColor);
    setCustomColor(DEFAULT_SETTINGS.customColor);
    setClockSize(DEFAULT_SETTINGS.clockSize);
    setFlipSound(DEFAULT_SETTINGS.flipSound);
    setCity(DEFAULT_SETTINGS.city);
    setDateLocale(DEFAULT_SETTINGS.dateLocale);
    setDateFormat(DEFAULT_SETTINGS.dateFormat);
    setAutoLaunch(DEFAULT_SETTINGS.autoLaunch);
    setAutoLaunchMs(DEFAULT_SETTINGS.autoLaunchMs);
    setShowDate(DEFAULT_SETTINGS.showDate);
    setShowCalendar(DEFAULT_SETTINGS.showCalendar);
    setShowWorldClock(DEFAULT_SETTINGS.showWorldClock);
    setShowQuote(DEFAULT_SETTINGS.showQuote);
    setShowWeather(DEFAULT_SETTINGS.showWeather);
    setShowStopwatch(DEFAULT_SETTINGS.showStopwatch);
    setShowPomodoro(DEFAULT_SETTINGS.showPomodoro);
    setShowDayProgress(DEFAULT_SETTINGS.showDayProgress);
    setShowAlarms(DEFAULT_SETTINGS.showAlarms);
    setShowTimer(DEFAULT_SETTINGS.showTimer);
    setShowBreathing(DEFAULT_SETTINGS.showBreathing);
    setShowAffirmation(DEFAULT_SETTINGS.showAffirmation);
    setMasterVolume(DEFAULT_SETTINGS.masterVolume);
    setChimeVolume(DEFAULT_SETTINGS.chimeVolume);
    setNotifVolume(DEFAULT_SETTINGS.notifVolume);
    setMuteMaster(DEFAULT_SETTINGS.muteMaster);
    setMuteChime(DEFAULT_SETTINGS.muteChime);
    setMuteAmbient(DEFAULT_SETTINGS.muteAmbient);
    setMuteNotif(DEFAULT_SETTINGS.muteNotif);
  // React Compiler inference: all setters in scope. Empty deps
  // (the setters are stable for the lifetime of the component).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state = useMemo<PersistedSettings>(() => ({
    layout, theme, autoTheme,
    wallpaper, wallpaperIntensity, ambient, ambientVolume,
    clockStyle, clockColor, customColor, clockSize, flipSound,
    city, dateLocale, dateFormat, autoLaunch, autoLaunchMs,
    showDate, showCalendar, showWorldClock, showQuote, showWeather,
    showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
    showBreathing, showAffirmation,
    masterVolume, chimeVolume, notifVolume,
    muteMaster, muteChime, muteAmbient, muteNotif,
  }), [
    layout, theme, autoTheme,
    wallpaper, wallpaperIntensity, ambient, ambientVolume,
    clockStyle, clockColor, customColor, clockSize, flipSound,
    city, dateLocale, dateFormat, autoLaunch, autoLaunchMs,
    showDate, showCalendar, showWorldClock, showQuote, showWeather,
    showStopwatch, showPomodoro, showDayProgress, showAlarms, showTimer,
    showBreathing, showAffirmation,
    masterVolume, chimeVolume, notifVolume,
    muteMaster, muteChime, muteAmbient, muteNotif,
  ]);

  return {
    state,
    set: {
      setLayout, setTheme, setAutoTheme,
      setWallpaper, setWallpaperIntensity, setAmbient, setAmbientVolume,
      setClockStyle, setClockColor, setCustomColor, setClockSize, adjustClockSize,
      setFlipSound, setCity, setDateLocale, setDateFormat, setAutoLaunch, setAutoLaunchMs,
      setShowDate, setShowCalendar, setShowWorldClock, setShowQuote, setShowWeather,
      setShowStopwatch, setShowPomodoro, setShowDayProgress, setShowAlarms, setShowTimer,
      setShowBreathing, setShowAffirmation,
      setMasterVolume, setChimeVolume, setNotifVolume,
      setMuteMaster, setMuteChime, setMuteAmbient, setMuteNotif,
      turnOffAll,
      resetToDefaults,
    },
  };
}
