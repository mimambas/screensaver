import { useState, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, Settings } from 'lucide-react';
import { DigitalClock, WorldClock, DateDisplay, CLOCK_STYLES, CLOCK_COLORS, CLOCK_SIZES, type ClockStyle, type ClockColor, type ClockSize } from './widgets/Clock';
import { Pomodoro } from './widgets/Pomodoro';
import { Stopwatch } from './widgets/Stopwatch';
import { Weather } from './widgets/Weather';
import { Quotes } from './widgets/Quotes';

type Layout = 'classic' | 'split' | 'minimal';
type Theme = 'dark' | 'light' | 'claude';

const isDark = (t: Theme) => t === 'dark';
const isClaude = (t: Theme) => t === 'claude';

export default function App() {
  const [layout, setLayout] = useState<Layout>('classic');
  const [showSettings, setShowSettings] = useState(false);
  const [showQuote, setShowQuote] = useState(true);
  const [showWorldClock, setShowWorldClock] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showStopwatch, setShowStopwatch] = useState(true);
  const [showPomodoro, setShowPomodoro] = useState(true);
  const [theme, setTheme] = useState<Theme>('dark');
  const [clockStyle, setClockStyle] = useState<ClockStyle>('digital');
  const [clockColor, setClockColor] = useState<ClockColor>('white');
  const [clockSize, setClockSize] = useState<ClockSize>('md');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const idleTimer = useRef<number>();

  // Auto-hide cursor + control buttons
  useEffect(() => {
    const reset = () => {
      document.body.style.cursor = 'default';
      setUiVisible(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        document.body.style.cursor = 'none';
        setUiVisible(false);
        setShowSettings(false);
      }, 3000);
    };
    window.addEventListener('mousemove', reset);
    reset();
    return () => {
      window.removeEventListener('mousemove', reset);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const allWidgetsOff =
    !showDate &&
    !showWorldClock &&
    !showQuote &&
    !showWeather &&
    !showStopwatch &&
    !showPomodoro;

  const turnOffAll = () => {
    setShowDate(false);
    setShowWorldClock(false);
    setShowQuote(false);
    setShowWeather(false);
    setShowStopwatch(false);
    setShowPomodoro(false);
  };

  const resetSettings = () => {
    setLayout('classic');
    setTheme('dark');
    setClockStyle('digital');
    setClockColor('white');
    setClockSize('md');
    setShowDate(true);
    setShowWorldClock(true);
    setShowQuote(true);
    setShowWeather(true);
    setShowStopwatch(true);
    setShowPomodoro(true);
  };

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

      {/* Controls — top right, fade on idle */}
      <div
        className={`absolute top-4 right-4 z-20 flex gap-2 transition-opacity duration-500 ${
          uiVisible ? 'opacity-60 hover:opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={toggleFullscreen}
          className={`p-2 rounded-full transition-colors ${
            isDark(theme) ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
          }`}
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-full transition-colors ${
            isDark(theme) ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
          }`}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className={`absolute top-16 right-4 z-20 backdrop-blur-xl border rounded-2xl p-4 w-64 ${
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
            {(['dark', 'light', 'claude'] as Theme[]).map((t) => (
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

          <div className={`text-xs uppercase tracking-widest opacity-70 mb-3 pt-3 ${isDark(theme) ? 'border-white/15' : isClaude(theme) ? 'border-[#d4b896]/40' : 'border-black/15'}`}>
            Clock Style
          </div>
          <div className="grid grid-cols-4 gap-1 mb-4">
            {CLOCK_STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setClockStyle(s)}
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
                {s === 'digital' ? '🔢' : s === 'analog' ? '🕰️' : s === 'retro' ? '📟' : '🔁'}
                <div className="mt-0.5">{s}</div>
              </button>
            ))}
          </div>

          <div className="text-xs uppercase tracking-widest opacity-70 mb-3">
            Clock Size
          </div>
          <div className="grid grid-cols-4 gap-1 mb-4">
            {CLOCK_SIZES.map((sz) => (
              <button
                key={sz.id}
                onClick={() => setClockSize(sz.id)}
                className={`px-1 py-2 rounded-lg text-[10px] transition-colors ${
                  clockSize === sz.id
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
                <div className="mb-1 font-bold">{sz.scale}×</div>
                <div>{sz.label}</div>
              </button>
            ))}
          </div>

          <div className="text-xs uppercase tracking-widest opacity-70 mb-3">
            Clock Color
          </div>
          <div className="grid grid-cols-3 gap-1 mb-4">
            {CLOCK_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setClockColor(c.id)}
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
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: c.hex, boxShadow: `0 0 8px ${c.hex}` }}
                />
                {c.label}
              </button>
            ))}
          </div>

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
              { label: 'Weather', val: showWeather, set: () => setShowWeather((v) => !v) },
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
        </div>
      )}

      {/* Layouts */}
      {layout === 'classic' && (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 gap-10">
          <DigitalClock style={clockStyle} color={clockColor} size={clockSize} />
          {showDate && <DateDisplay theme={theme} />}
          {showWorldClock && <WorldClock color={clockColor} theme={theme} />}

          {(showPomodoro || showStopwatch) && (
            <div className="flex flex-wrap items-start justify-center gap-12 mt-4">
              {showPomodoro && <Pomodoro theme={theme} />}
              {showStopwatch && <Stopwatch theme={theme} />}
            </div>
          )}

          {(showWeather || showQuote) && (
            <div className="flex flex-col items-center gap-6 mt-4">
              {showWeather && <Weather theme={theme} />}
              {showQuote && <Quotes />}
            </div>
          )}
        </div>
      )}

      {layout === 'split' && (
        <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-3 gap-6 p-12">
          {/* Left: time */}
          <div className="flex flex-col items-center justify-center gap-6 border-r border-white/10 pr-6">
            <DigitalClock style={clockStyle} color={clockColor} size={clockSize} />
            {showDate && <DateDisplay theme={theme} />}
            {showWorldClock && <WorldClock color={clockColor} theme={theme} />}
          </div>

          {/* Center: tools */}
          <div className="flex flex-col items-center justify-center gap-8 border-r border-white/10 pr-6">
            {showPomodoro && <Pomodoro theme={theme} />}
            {showStopwatch && <Stopwatch theme={theme} />}
          </div>

          {/* Right: info */}
          <div className="flex flex-col items-start justify-center gap-6">
            {showWeather && <Weather theme={theme} />}
            {showQuote && <Quotes />}
          </div>
        </div>
      )}

      {layout === 'minimal' && (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 gap-8">
          <DigitalClock style={clockStyle} color={clockColor} size={clockSize} />
          {showDate && <DateDisplay theme={theme} />}
          {showQuote && (
            <div className="absolute bottom-8">
              <Quotes />
            </div>
          )}
        </div>
      )}
    </div>
  );
}