// Settings context — exposes the persisted settings + their setters
// to descendants. The provider lives in App.tsx; descendants (layout
// components, settings panel) read from here instead of receiving
// 25 props. This keeps App.tsx focused on persistence + lifecycle
// effects, while the presentation layers stay declarative.

import { createContext, useContext } from 'react';
import type { Locale } from '../i18n';
import type { ThemeName } from './theme-presets';
import type {
  ClockColor,
  ClockSize,
  ClockStyle,
} from './clock-constants';
import type { WorldCity } from './use-world-cities';

export type Layout = 'classic' | 'split' | 'minimal';
export type WallpaperId =
  | 'none' | 'aurora' | 'stars' | 'rain' | 'geometric' | 'mesh' | 'fireflies';
// Ambient soundscape id. Mirrors the engine's AmbientStyle but
// adds 'none' (the off-state the UI uses to mute the engine).
export type AmbientId =
  | 'none'
  | 'rain'
  | 'forest'
  | 'white'
  | 'fireplace'
  | 'ocean'
  | 'stream'
  | 'wind'
  | 'night'
  | 'cafe';

export interface SettingsState {
  // Look & feel
  layout: Layout;
  theme: ThemeName;
  autoTheme: boolean;
  wallpaper: WallpaperId;
  wallpaperIntensity: number;
  ambient: AmbientId;
  ambientVolume: number;
  locale: Locale;
  // Clock
  clockStyle: ClockStyle;
  clockColor: ClockColor;
  customColor: string;
  clockSize: ClockSize;
  flipSound: boolean;
  // Date / city
  city: string;
  dateLocale: string;
  dateFormat: 'long' | 'short' | 'iso';
  // Auto-launch / fullscreen
  autoLaunch: boolean;
  autoLaunchMs: number;
  // Widget visibility
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
}

export interface SettingsActions {
  setLayout: (v: Layout) => void;
  setTheme: (v: ThemeName) => void;
  setAutoTheme: (v: boolean) => void;
  setWallpaper: (v: WallpaperId) => void;
  setWallpaperIntensity: (v: number) => void;
  setAmbient: (v: AmbientId) => void;
  setAmbientVolume: (v: number) => void;
  setLocale: (v: Locale) => void;
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
  toggleShow: (key: keyof Pick<
    SettingsState,
    | 'showDate'
    | 'showCalendar'
    | 'showWorldClock'
    | 'showQuote'
    | 'showWeather'
    | 'showStopwatch'
    | 'showPomodoro'
    | 'showDayProgress'
    | 'showAlarms'
    | 'showTimer'
    | 'showBreathing'
    | 'showAffirmation'
  >) => void;
  turnOffAll: () => void;
  resetToDefaults: () => void;
}

export interface SettingsContextValue extends SettingsState, SettingsActions {
  worldCities: WorldCity[];
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside <SettingsContext.Provider>');
  }
  return ctx;
}
