// Settings panel — modal dialog with all user-facing settings.
// Reads/writes everything through `useSettings()` so it doesn't
// need to receive any props. Theme tokens come from `THEMES[theme]`
// so the panel itself honors the active theme.

import { useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { CLOCK_STYLES, CLOCK_COLORS, CLOCK_SIZES, CLOCK_SIZE_PRESETS, normalizeHex } from './clock-constants';
import { THEME_NAMES } from './theme-presets';
import { CitiesManager } from './WorldClockCities';
import { useT, useLocale } from '../i18n';
import { useSettings } from './settings-context';
import { isDark, isClaude } from './theme-helpers';
import { playChimePreset, mixer } from './audio';

const SETTINGS_KEY = 'screensaver.settings.v2';

export function SettingsPanel() {
  const s = useSettings();
  const t = useT();
  const [locale] = useLocale();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      role="dialog"
      aria-label={t('settings.title')}
      className={`absolute top-16 right-4 z-20 backdrop-blur-xl border rounded-2xl p-4 w-72 max-h-[calc(100vh-5rem)] overflow-y-auto ${
        isDark(s.theme)
          ? 'bg-black/60 border-white/20 text-white'
          : isClaude(s.theme)
          ? 'bg-[#faf6ef]/95 border-[#d4b896]/40 text-[#3a2e1f] shadow-2xl'
          : 'bg-white/90 border-black/20 text-black shadow-2xl'
      }`}
    >
      {/* Layout */}
      <div className="text-xs uppercase tracking-widest opacity-70 mb-3">
        {t('settings.section.layout')}
      </div>
      <div className="space-y-1 mb-4">
        {(['classic', 'split', 'minimal'] as const).map((l) => (
          <button
            key={l}
            onClick={() => s.setLayout(l)}
            aria-pressed={s.layout === l}
            data-layout={l}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              s.layout === l
                ? isDark(s.theme)
                  ? 'bg-white/15 text-white'
                  : isClaude(s.theme)
                  ? 'bg-[#e8dcc4] text-[#3a2e1f]'
                  : 'bg-black/15 text-black'
                : isDark(s.theme)
                ? 'hover:bg-white/10 text-white/80'
                : isClaude(s.theme)
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

      {/* Language */}
      <Section title={t('settings.section.language')}>
        <div className="grid grid-cols-2 gap-1">
          {(['en', 'id'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => s.setLocale(lang)}
              aria-pressed={locale === lang}
              data-lang={lang}
              className={`px-2 py-2 rounded-lg text-xs transition-colors ${
                locale === lang
                  ? isDark(s.theme)
                    ? 'bg-white/15 text-white'
                    : isClaude(s.theme)
                    ? 'bg-[#d4b896] text-[#3a2e1f]'
                    : 'bg-black/15 text-black'
                  : isDark(s.theme)
                  ? 'hover:bg-white/10 text-white/80'
                  : isClaude(s.theme)
                  ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                  : 'hover:bg-black/10 text-black/80'
              }`}
            >
              {lang === 'en' ? t('settings.language.en') : t('settings.language.id')}
            </button>
          ))}
        </div>
      </Section>

      {/* Theme */}
      <Section title={t('settings.section.theme')}>
        <div className="grid grid-cols-4 gap-1 mb-4">
          {THEME_NAMES.map((themeId) => (
            <button
              key={themeId}
              onClick={() => s.setTheme(themeId)}
              data-theme={themeId}
              className={`px-2 py-2 rounded-lg text-xs transition-colors ${
                s.theme === themeId
                  ? isDark(s.theme)
                    ? 'bg-white/15 text-white'
                    : isClaude(s.theme)
                    ? 'bg-[#e8dcc4] text-[#3a2e1f]'
                    : 'bg-black/15 text-black'
                  : isDark(s.theme)
                  ? 'hover:bg-white/10 text-white/80'
                  : isClaude(s.theme)
                  ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                  : 'hover:bg-black/10 text-black/80'
              }`}
            >
              {themeId === 'dark'
                ? t('settings.theme.dark')
                : themeId === 'light'
                ? t('settings.theme.light')
                : themeId === 'claude'
                ? t('settings.theme.claude')
                : themeId === 'sunset'
                ? t('settings.theme.sunset')
                : themeId === 'forest'
                ? t('settings.theme.forest')
                : themeId === 'ocean'
                ? t('settings.theme.ocean')
                : t('settings.theme.paper')}
            </button>
          ))}
        </div>
        <Toggle
          label={t('settings.theme.auto')}
          value={s.autoTheme}
          onChange={s.setAutoTheme}
        />
        {s.autoLaunch && (
          <div className={`flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg text-[10px] ${
            isDark(s.theme) ? 'text-white/60' : isClaude(s.theme) ? 'text-[#3a2e1f]/60' : 'text-black/60'
          }`}>
            <span>{t('settings.fullscreen.after')}</span>
            <input
              type="number"
              min={1}
              max={120}
              value={Math.round(s.autoLaunchMs / 60_000)}
              onChange={(e) => {
                const m = Math.max(1, Math.min(120, Number(e.target.value) || 5));
                s.setAutoLaunchMs(m * 60_000);
              }}
              className={`w-12 bg-transparent text-center tabular-nums outline-none ${
                isDark(s.theme) ? 'text-white' : isClaude(s.theme) ? 'text-[#3a2e1f]' : 'text-black'
              }`}
            />
            <span>{t('settings.fullscreen.minIdle')}</span>
          </div>
        )}
      </Section>

      {/* Wallpaper */}
      <Section title={t('settings.section.wallpaper')}>
        <div className="grid grid-cols-4 gap-1 mb-2">
          {(['none', 'aurora', 'stars', 'rain', 'geometric', 'mesh', 'fireflies'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => s.setWallpaper(w)}
              aria-pressed={s.wallpaper === w}
              data-wallpaper={w}
              className={`px-1 py-2 rounded-lg text-[10px] capitalize transition-colors ${
                s.wallpaper === w
                  ? isDark(s.theme)
                    ? 'bg-white/15 text-white'
                    : isClaude(s.theme)
                    ? 'bg-[#d4b896] text-[#3a2e1f]'
                    : 'bg-black/15 text-black'
                  : isDark(s.theme)
                  ? 'hover:bg-white/10 text-white/80'
                  : isClaude(s.theme)
                  ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                  : 'hover:bg-black/10 text-black/80'
              }`}
            >
              {w === 'none' ? '∅' : w === 'aurora' ? '🌌' : w === 'stars' ? '✨' : w === 'rain' ? '🌧' : w === 'geometric' ? '◯' : w === 'mesh' ? '🌀' : '🪲'}{' '}
              {w}
            </button>
          ))}
        </div>
        {s.wallpaper !== 'none' && (
          <Range
            label={t('settings.wallpaper.intensity')}
            value={s.wallpaperIntensity}
            onChange={s.setWallpaperIntensity}
          />
        )}
      </Section>

      {/* Ambient */}
      <Section title={t('settings.section.ambient')}>
        <div className="grid grid-cols-5 gap-1 mb-2">
          {([
            { id: 'none', icon: '🔇' },
            { id: 'rain', icon: '🌧' },
            { id: 'forest', icon: '🌲' },
            { id: 'fireplace', icon: '🔥' },
            { id: 'ocean', icon: '🌊' },
            { id: 'stream', icon: '💧' },
            { id: 'wind', icon: '🌬' },
            { id: 'night', icon: '🌙' },
            { id: 'cafe', icon: '☕' },
            { id: 'white', icon: '🌫' },
          ] as const).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => s.setAmbient(a.id)}
              aria-pressed={s.ambient === a.id}
              title={t(`settings.ambient.${a.id}`)}
              className={`px-1 py-2 rounded-lg text-[10px] transition-colors ${
                s.ambient === a.id
                  ? isDark(s.theme)
                    ? 'bg-white/15 text-white'
                    : isClaude(s.theme)
                    ? 'bg-[#d4b896] text-[#3a2e1f]'
                    : 'bg-black/15 text-black'
                  : isDark(s.theme)
                  ? 'hover:bg-white/10 text-white/80'
                  : isClaude(s.theme)
                  ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                  : 'hover:bg-black/10 text-black/80'
              }`}
            >
              <span className="block text-base leading-none mb-0.5">{a.icon}</span>
              {t(`settings.ambient.${a.id}`)}
            </button>
          ))}
        </div>
        {s.ambient !== 'none' && (
          <Range
            label={t('settings.ambient.volume')}
            value={s.ambientVolume}
            onChange={s.setAmbientVolume}
          />
        )}
      </Section>

      {/* Audio mixer — independent per-stage volumes + mutes.
          Reads/writes go through the persisted-settings hook so
          reload restores the user's mix. The actual gain values
          are pushed into the AudioMixer singleton by App.tsx. */}
      <Section title={t('settings.section.audio')}>
        <div className="space-y-1.5">
          <MixerRow
            label={t('settings.audio.master')}
            value={s.masterVolume}
            muted={s.muteMaster}
            onVolume={s.setMasterVolume}
            onMute={s.setMuteMaster}
            t={t}
          />
          <MixerRow
            label={t('settings.audio.chime')}
            value={s.chimeVolume}
            muted={s.muteChime}
            onVolume={s.setChimeVolume}
            onMute={s.setMuteChime}
            t={t}
          />
          <MixerRow
            label={t('settings.audio.notif')}
            value={s.notifVolume}
            muted={s.muteNotif}
            onVolume={s.setNotifVolume}
            onMute={s.setMuteNotif}
            t={t}
          />
          {/* Ambient has no separate volume field here — it's
              controlled by the ambient picker above. We expose
              the mute so the user can silence the rain without
              losing the soundscape selection. */}
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] ${
                isDark(s.theme) ? 'text-white/80' : isClaude(s.theme) ? 'text-[#3a2e1f]/80' : 'text-black/80'
              }`}
            >
              Ambient
            </span>
            <button
              type="button"
              data-testid="mixer-mute-ambient"
              onClick={() => s.setMuteAmbient(!s.muteAmbient)}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                s.muteAmbient
                  ? isDark(s.theme)
                    ? 'bg-white/20 text-white'
                    : isClaude(s.theme)
                    ? 'bg-[#3a2e1f]/15 text-[#3a2e1f]'
                    : 'bg-black/15 text-black'
                  : isDark(s.theme)
                  ? 'bg-white/5 hover:bg-white/10 text-white/70'
                  : isClaude(s.theme)
                  ? 'bg-[#3a2e1f]/5 hover:bg-[#3a2e1f]/10 text-[#3a2e1f]/70'
                  : 'bg-black/5 hover:bg-black/10 text-black/70'
              }`}
            >
              {s.muteAmbient ? t('settings.audio.unmute') : t('settings.audio.mute')}
            </button>
          </div>
        </div>
        <button
          type="button"
          data-testid="mixer-test"
          onClick={() => {
            // Plays one chime + one notif in sequence so the
            // user can hear both stages without waiting for an
            // alarm or pomodoro to fire.
            mixer.ensureContext();
            playChimePreset('bell');
            window.setTimeout(() => playChimePreset('ding'), 800);
          }}
          className={`mt-2 w-full text-[11px] px-2 py-1.5 rounded transition-colors ${
            isDark(s.theme)
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : isClaude(s.theme)
              ? 'bg-[#3a2e1f]/10 hover:bg-[#3a2e1f]/20 text-[#3a2e1f]'
              : 'bg-black/10 hover:bg-black/20 text-black'
          }`}
          title={t('settings.audio.testHint')}
        >
          {t('settings.audio.test')}
        </button>
      </Section>

      {/* Clock style */}
      <Section title={t('settings.section.clockStyle')}>
        <div className="grid grid-cols-5 gap-1">
          {CLOCK_STYLES.map((st) => (
            <button
              key={st}
              onClick={() => s.setClockStyle(st)}
              aria-pressed={s.clockStyle === st}
              data-clock-style={st}
              className={`px-1 py-2 rounded-lg text-[10px] capitalize transition-colors ${
                s.clockStyle === st
                  ? isDark(s.theme)
                    ? 'bg-white/15 text-white'
                    : isClaude(s.theme)
                    ? 'bg-[#e8dcc4] text-[#3a2e1f]'
                    : 'bg-black/15 text-black'
                  : isDark(s.theme)
                  ? 'hover:bg-white/10 text-white/80'
                  : isClaude(s.theme)
                  ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/80'
                  : 'hover:bg-black/10 text-black/80'
              }`}
            >
              {st === 'digital' ? '🔢' : st === 'analog' ? '🕰️' : st === 'retro' ? '📟' : st === 'flip' ? '🔁' : '⌚'}
              <div className="mt-0.5">{st}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Clock size */}
      <Section title={t('settings.section.clockSize')}>
        <div className="flex items-stretch gap-1 mb-2">
          <button
            type="button"
            onClick={() => s.adjustClockSize(-CLOCK_SIZE_PRESETS.step)}
            disabled={s.clockSize <= CLOCK_SIZE_PRESETS.min}
            aria-label={t('clock.decrease')}
            className={`px-2 rounded-lg text-sm transition-colors ${
              s.clockSize <= CLOCK_SIZE_PRESETS.min
                ? isDark(s.theme)
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : isClaude(s.theme)
                  ? 'bg-[#e8dcc4]/40 text-[#3a2e1f]/30 cursor-not-allowed'
                  : 'bg-black/5 text-black/30 cursor-not-allowed'
                : isDark(s.theme)
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : isClaude(s.theme)
                ? 'bg-[#e8dcc4] hover:bg-[#f0e6d2] text-[#3a2e1f]'
                : 'bg-black/10 hover:bg-black/20 text-black'
            }`}
          >
            <Minus className="w-3 h-3" />
          </button>
          <div className={`flex-1 flex items-baseline justify-center gap-1 rounded-lg tabular-nums ${
            isDark(s.theme)
              ? 'bg-white/10 text-white'
              : isClaude(s.theme)
              ? 'bg-[#e8dcc4] text-[#3a2e1f]'
              : 'bg-black/10 text-black'
          }`}>
            <span className="text-base font-semibold">{(s.clockSize as number).toFixed(1)}</span>
            <span className="text-[10px] opacity-60">×</span>
          </div>
          <button
            type="button"
            onClick={() => s.adjustClockSize(CLOCK_SIZE_PRESETS.step)}
            disabled={s.clockSize >= CLOCK_SIZE_PRESETS.max}
            aria-label={t('clock.increase')}
            className={`px-2 rounded-lg text-sm transition-colors ${
              s.clockSize >= CLOCK_SIZE_PRESETS.max
                ? isDark(s.theme)
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : isClaude(s.theme)
                  ? 'bg-[#e8dcc4]/40 text-[#3a2e1f]/30 cursor-not-allowed'
                  : 'bg-black/5 text-black/30 cursor-not-allowed'
                : isDark(s.theme)
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : isClaude(s.theme)
                ? 'bg-[#e8dcc4] hover:bg-[#f0e6d2] text-[#3a2e1f]'
                : 'bg-black/10 hover:bg-black/20 text-black'
            }`}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 -mt-1">
          {CLOCK_SIZES.map((sz) => (
            <button
              key={sz.label}
              onClick={() => s.setClockSize(sz.scale)}
              aria-pressed={Math.abs((s.clockSize as number) - sz.scale) < 0.05}
              className={`px-1 py-1.5 rounded-lg text-[10px] transition-colors ${
                Math.abs((s.clockSize as number) - sz.scale) < 0.05
                  ? isDark(s.theme)
                    ? 'bg-white/15 text-white'
                    : isClaude(s.theme)
                    ? 'bg-[#d6c8a8] text-[#3a2e1f]'
                    : 'bg-black/15 text-black'
                  : isDark(s.theme)
                  ? 'hover:bg-white/10 text-white/70'
                  : isClaude(s.theme)
                  ? 'hover:bg-[#f0e6d2] text-[#3a2e1f]/70'
                  : 'hover:bg-black/10 text-black/70'
              }`}
            >
              {sz.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Clock color */}
      <div className="flex items-baseline justify-between mb-2 pt-3 border-t border-current/15">
        <div className="text-xs uppercase tracking-widest opacity-70">
          {t('settings.section.clockColor')}
        </div>
        <div className="text-[10px] opacity-50">
          {s.clockColor === 'custom'
            ? s.customColor
            : CLOCK_COLORS.find((c) => c.id === s.clockColor)?.label ?? s.clockColor}
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1.5 mb-2">
        {CLOCK_COLORS.map((c) => {
          // Contrast hint: white-on-light or ink-on-dark are
          // likely invisible. Don't block the choice — let the
          // user see the result and decide.
          const poorContrast =
            (c.id === 'white' && s.theme !== 'dark') ||
            (c.id === 'ink' && s.theme === 'dark');
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => s.setClockColor(c.id)}
              aria-pressed={s.clockColor === c.id}
              aria-label={c.label}
              data-color={c.id}
              data-poor-contrast={poorContrast ? '1' : '0'}
              title={
                poorContrast
                  ? `${c.label} — may be hard to read on this theme`
                  : c.label
              }
              className={`aspect-square rounded-lg transition-transform border ${
                s.clockColor === c.id
                  ? isDark(s.theme)
                    ? 'ring-2 ring-white/80 scale-105'
                    : isClaude(s.theme)
                    ? 'ring-2 ring-[#3a2e1f]/70 scale-105'
                    : 'ring-2 ring-black/70 scale-105'
                  : 'hover:scale-110'
              }`}
              style={{
                backgroundColor: c.hex,
                borderColor: c.id === 'white' || c.id === 'gold' || c.id === 'lavender' || c.id === 'peach' || c.id === 'mint'
                  ? 'rgba(0,0,0,0.15)'
                  : 'transparent',
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => s.setClockColor('custom')}
          aria-pressed={s.clockColor === 'custom'}
          data-color="custom"
          title={t('settings.clockColor.custom')}
          className={`aspect-square w-9 rounded-lg transition-transform border ${
            s.clockColor === 'custom'
              ? isDark(s.theme)
                ? 'ring-2 ring-white/80 scale-105'
                : isClaude(s.theme)
                ? 'ring-2 ring-[#3a2e1f]/70 scale-105'
                : 'ring-2 ring-black/70 scale-105'
              : 'hover:scale-110'
          }`}
          style={{ backgroundColor: s.customColor }}
        />
        <input
          type="color"
          value={s.customColor}
          onChange={(e) => s.setCustomColor(e.target.value)}
          aria-label={t('settings.clockColor.customHex')}
          data-custom-color-input
          className={`w-8 h-8 bg-transparent border rounded cursor-pointer ${
            isDark(s.theme) ? 'border-white/20' : 'border-black/20'
          }`}
        />
        <input
          type="text"
          value={s.customColor}
          onChange={(e) => {
            const norm = normalizeHex(e.target.value);
            if (norm) s.setCustomColor(norm);
          }}
          aria-label={t('settings.clockColor.customHexText')}
          data-custom-color-text
          placeholder="#a78bfa"
          className={`flex-1 px-2 py-1 rounded text-[11px] font-mono outline-none ${
            isDark(s.theme)
              ? 'bg-white/10 text-white placeholder-white/30 focus:bg-white/15'
              : isClaude(s.theme)
              ? 'bg-[#f0e6d2] text-[#3a2e1f] placeholder-[#3a2e1f]/40 focus:bg-[#e8dcc4]'
              : 'bg-black/5 text-black placeholder-black/40 focus:bg-black/10'
          }`}
        />
      </div>

      {/* Weather city */}
      <div className="text-xs uppercase tracking-widest opacity-70 mb-2 pt-3 border-t border-current/15">
        {t('settings.section.weatherCity')}
      </div>
      <input
        type="text"
        value={s.city}
        onChange={(e) => s.setCity(e.target.value)}
        placeholder={t('settings.weather.placeholder')}
        className={`w-full px-3 py-2 rounded-lg text-sm mb-4 outline-none ${
          isDark(s.theme)
            ? 'bg-white/10 text-white placeholder-white/40 focus:bg-white/15'
            : isClaude(s.theme)
            ? 'bg-[#f0e6d2] text-[#3a2e1f] placeholder-[#3a2e1f]/40 focus:bg-[#e8dcc4]'
            : 'bg-black/5 text-black placeholder-black/40 focus:bg-black/10'
        }`}
      />

      {/* Visibility toggles */}
      <Section title={t('settings.weather.visibility')}>
        <div className="flex gap-1 mb-3">
          <button
            type="button"
            onClick={s.turnOffAll}
            disabled={
              !s.showDate &&
              !s.showCalendar &&
              !s.showWorldClock &&
              !s.showQuote &&
              !s.showWeather &&
              !s.showStopwatch &&
              !s.showPomodoro &&
              !s.showDayProgress &&
              !s.showAlarms &&
              !s.showBreathing &&
              !s.showAffirmation
            }
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              isDark(s.theme)
                ? 'bg-white/5 hover:bg-white/15 disabled:bg-white/5 disabled:opacity-40'
                : isClaude(s.theme)
                ? 'bg-[#e8dcc4]/40 hover:bg-[#e8dcc4] disabled:bg-[#e8dcc4]/20 disabled:opacity-40 text-[#3a2e1f]'
                : 'bg-black/5 hover:bg-black/15 disabled:bg-black/5 disabled:opacity-40'
            }`}
          >
            Turn Off All
          </button>
          <button
            type="button"
            onClick={s.resetToDefaults}
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              isDark(s.theme)
                ? 'bg-white/5 hover:bg-white/15 text-white/80'
                : isClaude(s.theme)
                ? 'bg-[#e8dcc4]/40 hover:bg-[#e8dcc4] text-[#3a2e1f]/80'
                : 'bg-black/5 hover:bg-black/15 text-black/80'
            }`}
          >
            {t('common.reset')}
          </button>
        </div>
        <div className="space-y-1">
          <Toggle label="Date" value={s.showDate} onChange={s.setShowDate} />
          <Toggle label="Calendar" value={s.showCalendar} onChange={s.setShowCalendar} />
          <Toggle label="World Clock" value={s.showWorldClock} onChange={s.setShowWorldClock} />
          <Toggle label="Quotes" value={s.showQuote} onChange={s.setShowQuote} />
          <Toggle label="Pomodoro" value={s.showPomodoro} onChange={s.setShowPomodoro} />
          <Toggle label="Stopwatch" value={s.showStopwatch} onChange={s.setShowStopwatch} />
          <Toggle label="Timer" value={s.showTimer} onChange={s.setShowTimer} />
          <Toggle label="Breathing" value={s.showBreathing} onChange={s.setShowBreathing} />
          <Toggle label="Affirmation" value={s.showAffirmation} onChange={s.setShowAffirmation} />
          <Toggle label="Weather" value={s.showWeather} onChange={s.setShowWeather} />
          <Toggle label="Day Progress" value={s.showDayProgress} onChange={s.setShowDayProgress} />
          <Toggle label="Alarms" value={s.showAlarms} onChange={s.setShowAlarms} />
          <Toggle label="Flip Sound" value={s.flipSound} onChange={s.setFlipSound} />
          <Toggle label="Auto-launch" value={s.autoLaunch} onChange={s.setAutoLaunch} />
        </div>
      </Section>

      {s.showWorldClock && (
        <div className="mt-3">
          <div className={`text-[10px] uppercase tracking-widest opacity-70 mb-2 ${
            isDark(s.theme) ? 'text-white/60' : isClaude(s.theme) ? 'text-[#3a2e1f]/60' : 'text-black/60'
          }`}>
            {t('settings.section.cities', { n: s.worldCities.length })}
          </div>
          <CitiesManager theme={s.theme} />
        </div>
      )}

      {s.showDate && (
        <div
          className={`mt-3 space-y-2 text-[10px] ${
            isDark(s.theme) ? 'text-white/60' : isClaude(s.theme) ? 'text-[#3a2e1f]/60' : 'text-black/60'
          }`}
        >
          <div className="flex gap-1">
            {(['en-US', 'id-ID'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => s.setDateLocale(loc)}
                aria-pressed={s.dateLocale === loc}
                className={`flex-1 px-2 py-1 rounded text-[10px] transition-colors ${
                  s.dateLocale === loc
                    ? isDark(s.theme)
                      ? 'bg-white/15 text-white'
                      : isClaude(s.theme)
                      ? 'bg-[#d4b896] text-[#3a2e1f]'
                      : 'bg-black/15 text-black'
                    : isDark(s.theme)
                    ? 'hover:bg-white/10 text-white/70'
                    : isClaude(s.theme)
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
                onClick={() => s.setDateFormat(f)}
                aria-pressed={s.dateFormat === f}
                className={`flex-1 px-2 py-1 rounded text-[10px] transition-colors ${
                  s.dateFormat === f
                    ? isDark(s.theme)
                      ? 'bg-white/15 text-white'
                      : isClaude(s.theme)
                      ? 'bg-[#d4b896] text-[#3a2e1f]'
                      : 'bg-black/15 text-black'
                    : isDark(s.theme)
                    ? 'hover:bg-white/10 text-white/70'
                    : isClaude(s.theme)
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

      {/* Shortcut hint */}
      <div className={`text-[10px] mt-4 opacity-40 leading-relaxed ${isDark(s.theme) ? 'text-white' : 'text-black'}`}>
        {t('settings.section.shortcuts')} <kbd className="px-1 border border-current/30 rounded">F</kbd> {t('shortcuts.hint.fullscreen')} ·{' '}
        <kbd className="px-1 border border-current/30 rounded">S</kbd> {t('shortcuts.hint.settings')} ·{' '}
        <kbd className="px-1 border border-current/30 rounded">H</kbd> {t('shortcuts.hint.hideUI')} ·{' '}
        <kbd className="px-1 border border-current/30 rounded">Esc</kbd> {t('shortcuts.hint.closeWakeShort')}
      </div>

      {/* Backup */}
      <Section title={t('settings.section.backup')}>
        <div className="flex gap-1">
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
                /* ignore */
              }
            }}
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              isDark(s.theme)
                ? 'bg-white/5 hover:bg-white/15 text-white'
                : isClaude(s.theme)
                ? 'bg-[#e8dcc4] hover:bg-[#d4b896] text-[#3a2e1f]'
                : 'bg-black/5 hover:bg-black/15 text-black'
            }`}
          >
            {t('settings.backup.export')}
          </button>
          <label
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs text-center transition-colors cursor-pointer ${
              isDark(s.theme)
                ? 'bg-white/5 hover:bg-white/15 text-white'
                : isClaude(s.theme)
                ? 'bg-[#e8dcc4] hover:bg-[#d4b896] text-[#3a2e1f]'
                : 'bg-black/5 hover:bg-black/15 text-black'
            }`}
          >
            {t('settings.backup.import')}
            <input
              ref={importInputRef}
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
                    const parsed = JSON.parse(text);
                    if (typeof parsed !== 'object' || parsed === null || !('layout' in parsed)) {
                      throw new Error('not a settings file');
                    }
                    window.localStorage.setItem(SETTINGS_KEY, text);
                    window.location.reload();
                  } catch {
                    /* bad file — ignore */
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </Section>
    </div>
  );
}

// ── Internal helpers ─────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-3 border-t border-current/15">
      <div className="text-xs uppercase tracking-widest opacity-70 mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const s = useSettings();
  return (
    <label
      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${
        isDark(s.theme)
          ? 'hover:bg-white/10'
          : isClaude(s.theme)
          ? 'hover:bg-[#f0e6d2]'
          : 'hover:bg-black/10'
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value
            ? isDark(s.theme)
              ? 'bg-white/50'
              : isClaude(s.theme)
              ? 'bg-[#a87a4a]'
              : 'bg-black/60'
            : isDark(s.theme)
            ? 'bg-white/15'
            : isClaude(s.theme)
            ? 'bg-[#d4b896]/50'
            : 'bg-black/20'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full transition-transform bg-white ${
            value ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

function Range({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const s = useSettings();
  return (
    <label
      className={`flex items-center gap-2 mb-1 px-2 py-1.5 rounded-lg text-[10px] ${
        isDark(s.theme) ? 'text-white/60' : isClaude(s.theme) ? 'text-[#3a2e1f]/60' : 'text-black/60'
      }`}
    >
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-current"
      />
    </label>
  );
}

// MixerRow — compact horizontal slider + mute toggle. Used for
// the master / chime / notif stages in the Audio Mixer section.
function MixerRow({
  label,
  value,
  muted,
  onVolume,
  onMute,
  t,
}: {
  label: string;
  value: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onMute: (v: boolean) => void;
  t: (k: string) => string;
}) {
  const s = useSettings();
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
      <span
        className={`text-[11px] w-24 truncate ${
          isDark(s.theme) ? 'text-white/80' : isClaude(s.theme) ? 'text-[#3a2e1f]/80' : 'text-black/80'
        }`}
      >
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onVolume(Number(e.target.value))}
        className="flex-1 accent-current"
      />
      <button
        type="button"
        onClick={() => onMute(!muted)}
        data-testid={`mixer-mute-${label.toLowerCase().split(' ')[0]}`}
        className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
          muted
            ? isDark(s.theme)
              ? 'bg-white/20 text-white'
              : isClaude(s.theme)
              ? 'bg-[#3a2e1f]/15 text-[#3a2e1f]'
              : 'bg-black/15 text-black'
            : isDark(s.theme)
            ? 'bg-white/5 hover:bg-white/10 text-white/70'
            : isClaude(s.theme)
            ? 'bg-[#3a2e1f]/5 hover:bg-[#3a2e1f]/10 text-[#3a2e1f]/70'
            : 'bg-black/5 hover:bg-black/10 text-black/70'
        }`}
      >
        {muted ? t('settings.audio.unmute') : t('settings.audio.mute')}
      </button>
    </div>
  );
}
