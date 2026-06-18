// App.tsx — top-level orchestrator. Now thin: hook owns persistence,
// contexts own state sharing, layouts and the settings panel own
// presentation. App.tsx's job is the lifecycle effects (autoTheme,
// fullscreen, idle, PWA mode) and the chrome (sleep chip, top-right
// buttons, shortcut hint, body background + wallpaper).

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Maximize2, Minimize2, Settings } from 'lucide-react';
import { THEMES } from './widgets/theme-presets';
import { useSleepTimer } from './widgets/use-sleep-timer';
import { SleepTimerOverlay, SleepTimerChip } from './widgets/SleepTimer';
import { Wallpaper } from './widgets/Wallpaper';
import { useWorldCities } from './widgets/use-world-cities';
import { useAmbient } from './widgets/Ambient';
import { mixer } from './widgets/audio';
import { useT, useLocale } from './i18n';
import {
  SettingsContext,
  type SettingsContextValue,
} from './widgets/settings-context';
import { isDark, isClaude } from './widgets/theme-helpers';
import { usePersistedSettings } from './widgets/use-persisted-settings';
import { SettingsPanel } from './widgets/SettingsPanel';
import { LayoutClassic } from './widgets/LayoutClassic';
import { LayoutSplit } from './widgets/LayoutSplit';
import { LayoutMinimal } from './widgets/LayoutMinimal';

export default function App() {
  const { state, set } = usePersistedSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // When launched as an installed PWA the browser chrome is already
  // gone — fullscreen toggle is a no-op. Detect via display-mode media
  // query (true on iOS home-screen launches and Android TWA).
  const [isStandalone, setIsStandalone] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  const t = useT();
  const [locale, setLocale] = useLocale();
  const worldCities = useWorldCities();
  const idleTimer = useRef<number | null>(null);
  const autoLaunchTimer = useRef<number | null>(null);
  const sleep = useSleepTimer();

  // ── Context value (stable references where possible) ────────────
  const ctxValue = useMemo<SettingsContextValue>(() => ({
    ...state,
    worldCities,
    locale,
    setLocale,
    ...set,
    // toggleShow is defined as a no-op here; consumers that need
    // per-key toggles can just call the explicit setter.
    toggleShow: () => {},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, worldCities, locale, set]);

  // ── Auto-theme: switch to light/dark based on local hour ────────
  useEffect(() => {
    if (!state.autoTheme) return;
    const pick = () => {
      const h = new Date().getHours();
      set.setTheme(h >= 6 && h < 18 ? 'light' : 'dark');
    };
    pick();
    const id = window.setInterval(pick, 60_000);
    return () => window.clearInterval(id);
  }, [state.autoTheme, set]);

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
        if (state.autoLaunch && !document.fullscreenElement) {
          autoLaunchTimer.current = window.setTimeout(() => {
            if (state.autoLaunch && !document.fullscreenElement) {
              void toggleFullscreen();
            }
          }, state.autoLaunchMs);
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
  }, [sleep.isAsleep, state.autoLaunch, state.autoLaunchMs, toggleFullscreen]);

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
  useAmbient(state.ambient, state.ambientVolume);

  // Sync the persisted mixer volumes + mutes into the running
  // AudioMixer. The mixer is a process singleton so we apply
  // each setting once per render — WebAudio's setTargetAtTime is
  // cheap (no audio glitches on rapid value changes).
  useEffect(() => {
    mixer.setVolume('master', state.masterVolume);
    mixer.setVolume('chime', state.chimeVolume);
    mixer.setVolume('notif', state.notifVolume);
    mixer.setMuted('master', state.muteMaster);
    mixer.setMuted('chime', state.muteChime);
    mixer.setMuted('ambient', state.muteAmbient);
    mixer.setMuted('notif', state.muteNotif);
  }, [
    state.masterVolume, state.chimeVolume, state.notifVolume,
    state.muteMaster, state.muteChime, state.muteAmbient, state.muteNotif,
  ]);

  // While asleep, render nothing — black overlay handles the rest.
  if (sleep.isAsleep) {
    return <SleepTimerOverlay show onWake={sleep.wake} />;
  }

  const palette = THEMES[state.theme];

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
        {state.wallpaper !== 'none' && (
          <Wallpaper
            style={state.wallpaper}
            intensity={state.wallpaperIntensity}
            isDark={isDark(state.theme)}
          />
        )}

        {/* Sleep timer chip — top left */}
        <div
          className={`transition-opacity duration-500 ${
            uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <SleepTimerChip handle={sleep} theme={state.theme} />
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
                : isDark(state.theme)
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
              isDark(state.theme) ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
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
          {state.clockStyle === 'casio' && (
            <div
              className={`text-[11px] tracking-wider tabular-nums flex items-center gap-3 px-3 py-1 rounded-full backdrop-blur-sm ${
                isDark(state.theme)
                  ? 'bg-white/5 text-white/70'
                  : isClaude(state.theme)
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
              isDark(state.theme)
                ? 'bg-white/5 text-white/70'
                : isClaude(state.theme)
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
        {state.layout === 'classic' && <LayoutClassic />}
        {state.layout === 'split' && <LayoutSplit />}
        {state.layout === 'minimal' && <LayoutMinimal />}
      </div>
    </SettingsContext.Provider>
  );
}
