import { useState, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, Settings } from 'lucide-react';
import { DigitalClock, WorldClock, DateDisplay } from './widgets/Clock';
import { Pomodoro } from './widgets/Pomodoro';
import { Stopwatch } from './widgets/Stopwatch';
import { Weather } from './widgets/Weather';
import { Quotes } from './widgets/Quotes';

type Layout = 'classic' | 'split' | 'minimal';

export default function App() {
  const [layout, setLayout] = useState<Layout>('classic');
  const [showSettings, setShowSettings] = useState(false);
  const [showQuote, setShowQuote] = useState(true);
  const [showWorldClock, setShowWorldClock] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showStopwatch, setShowStopwatch] = useState(true);
  const [showPomodoro, setShowPomodoro] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const idleTimer = useRef<number>();

  // Auto-hide cursor
  useEffect(() => {
    const reset = () => {
      document.body.style.cursor = 'default';
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        document.body.style.cursor = 'none';
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

  return (
    <div
      className={`min-h-screen w-screen relative overflow-hidden transition-colors duration-500 ${
        theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      {/* Subtle radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at center, rgba(0,0,0,0.03) 0%, transparent 60%)',
        }}
      />

      {/* Controls — top right, fade on idle */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-60 hover:opacity-100 transition-opacity">
        <button
          onClick={toggleFullscreen}
          className={`p-2 rounded-full transition-colors ${
            theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
          }`}
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-full transition-colors ${
            theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
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
            theme === 'dark'
              ? 'bg-white/5 border-white/10'
              : 'bg-black/5 border-black/10'
          }`}
        >
          <div className="text-xs uppercase tracking-widest opacity-50 mb-3">Layout</div>
          <div className="space-y-1 mb-4">
            {(['classic', 'split', 'minimal'] as Layout[]).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  layout === l
                    ? theme === 'dark'
                      ? 'bg-white/10 text-white'
                      : 'bg-black/10 text-black'
                    : theme === 'dark'
                    ? 'hover:bg-white/5 text-white/70'
                    : 'hover:bg-black/5 text-black/70'
                }`}
              >
                {l === 'classic' && '⏰ Classic'}
                {l === 'split' && '🪟 Split View'}
                {l === 'minimal' && '🌑 Minimal'}
              </button>
            ))}
          </div>

          <div className="text-xs uppercase tracking-widest opacity-50 mb-3 pt-3 border-t border-white/10">
            Theme
          </div>
          <div className="grid grid-cols-2 gap-1 mb-4">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  theme === t
                    ? theme === 'dark'
                      ? 'bg-white/10 text-white'
                      : 'bg-black/10 text-black'
                    : theme === 'dark'
                    ? 'hover:bg-white/5 text-white/70'
                    : 'hover:bg-black/5 text-black/70'
                }`}
              >
                {t === 'dark' ? '🌑 Dark' : '☀️ Light'}
              </button>
            ))}
          </div>

          <div className="text-xs uppercase tracking-widest opacity-50 mb-3 pt-3 border-t border-white/10">
            Visibility
          </div>
          <div className="space-y-1">
            {[
              { label: 'Digital Clock', val: true, set: () => {} }, // always on
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
                  theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'
                }`}
              >
                <span className="text-sm">{opt.label}</span>
                <input
                  type="checkbox"
                  checked={opt.val}
                  onChange={opt.set}
                  disabled={opt.label === 'Digital Clock'}
                  className="accent-current"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Layouts */}
      {layout === 'classic' && (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 gap-12">
          <DigitalClock />
          {showDate && <DateDisplay />}
          {showWorldClock && <WorldClock />}
          {showQuote && <Quotes />}
        </div>
      )}

      {layout === 'split' && (
        <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-3 gap-6 p-12">
          {/* Left: time */}
          <div className="flex flex-col items-center justify-center gap-6 border-r border-white/10 pr-6">
            <DigitalClock />
            {showDate && <DateDisplay />}
            {showWorldClock && <WorldClock />}
          </div>

          {/* Center: tools */}
          <div className="flex flex-col items-center justify-center gap-8 border-r border-white/10 pr-6">
            {showPomodoro && <Pomodoro />}
            {showStopwatch && <Stopwatch />}
          </div>

          {/* Right: info */}
          <div className="flex flex-col items-start justify-center gap-6">
            {showWeather && <Weather />}
            {showQuote && <Quotes />}
          </div>
        </div>
      )}

      {layout === 'minimal' && (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 gap-8">
          <DigitalClock />
          {showDate && <DateDisplay />}
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