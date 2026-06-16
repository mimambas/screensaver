import { useEffect, useState } from 'react';
import { Moon, X } from 'lucide-react';
import type { ThemeName } from './clock-constants';
import type { SleepTimerHandle } from './use-sleep-timer';

// --------------------------------------------------------------------------
// SleepTimerOverlay — full-screen black veil with "Tap to wake" prompt.
// Render this in App.tsx when `isAsleep` is true.
// --------------------------------------------------------------------------

export function SleepTimerOverlay({
  show,
  onWake,
}: {
  show: boolean;
  onWake: () => void;
}) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!show) {
      queueMicrotask(() => setOpacity(0));
      return;
    }
    // 1.5s fade-in to full black
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = t - start;
      const v = Math.min(1, elapsed / 1500);
      setOpacity(v);
      if (v < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [show]);

  if (!show) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onWake}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onWake();
        }
      }}
      aria-label="Tap to wake"
      className="fixed inset-0 z-50 bg-black cursor-pointer flex items-center justify-center transition-opacity"
      style={{
        opacity,
        pointerEvents: opacity > 0.1 ? 'auto' : 'none',
      }}
    >
      <div className="text-white/30 text-sm flex flex-col items-center gap-2">
        <Moon className="w-8 h-8" />
        <div>Tap anywhere to wake</div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// SleepTimerChip — small "Sleep in 30:00" pill. Shown top-left while active.
// --------------------------------------------------------------------------

export function SleepTimerChip({
  handle,
  theme = 'dark',
}: {
  handle: SleepTimerHandle;
  theme?: ThemeName;
}) {
  const [showInput, setShowInput] = useState(false);
  const [draft, setDraft] = useState('30');

  const remaining = handle.remainingMs;
  const mm = String(Math.floor(remaining / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0');

  if (!handle.active && !showInput) {
    return (
      <button
        type="button"
        onClick={() => setShowInput(true)}
        className={`absolute top-4 left-4 z-20 p-2 rounded-full transition-colors ${
          theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/60' : 'bg-black/5 hover:bg-black/10 text-black/60'
        }`}
        title="Set sleep timer"
        aria-label="Set sleep timer"
      >
        <Moon className="w-4 h-4" />
      </button>
    );
  }

  if (showInput && !handle.active) {
    return (
      <div
        className={`absolute top-4 left-4 z-20 flex items-center gap-1 backdrop-blur-xl border rounded-full pl-2 pr-1 py-1 ${
          theme === 'dark' ? 'bg-black/60 border-white/20 text-white' : 'bg-white/90 border-black/20 text-black'
        }`}
      >
        <Moon className="w-3 h-3 ml-1" />
        {[15, 30, 60, 120].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              handle.start(m);
              setShowInput(false);
            }}
            className={`px-2 py-0.5 rounded text-[10px] ${
              theme === 'dark' ? 'hover:bg-white/15' : 'hover:bg-black/10'
            }`}
          >
            {m}m
          </button>
        ))}
        <span className={`text-[10px] opacity-50 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>·</span>
        <input
          type="number"
          min={1}
          max={480}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const n = Math.max(1, Math.min(480, Number(draft) || 0));
              if (n > 0) {
                handle.start(n);
                setShowInput(false);
              }
            } else if (e.key === 'Escape') {
              setShowInput(false);
            }
          }}
          className={`w-12 bg-transparent text-sm outline-none ${theme === 'dark' ? 'text-white' : 'text-black'}`}
          aria-label="Minutes until sleep"
        />
        <span className="text-xs opacity-70">min</span>
        <button
          type="button"
          onClick={() => setShowInput(false)}
          className="ml-1 opacity-60 hover:opacity-100"
          aria-label="Cancel"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handle.cancel}
      className={`absolute top-4 left-4 z-20 flex items-center gap-2 backdrop-blur-xl border rounded-full px-3 py-1.5 transition-colors ${
        theme === 'dark'
          ? 'bg-black/60 border-white/20 text-white hover:bg-black/80'
          : 'bg-white/90 border-black/20 text-black hover:bg-white'
      }`}
      title="Cancel sleep timer"
      aria-label={`Sleep timer: ${mm} minutes ${ss} seconds remaining. Click to cancel.`}
    >
      <Moon className="w-3 h-3" />
      <span className="text-xs tabular-nums">{mm}:{ss}</span>
    </button>
  );
}
