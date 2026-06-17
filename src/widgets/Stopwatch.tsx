import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Flag } from 'lucide-react';
import { useT } from '../i18n';

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 10));
  const minutes = Math.floor(total / 6000);
  const seconds = Math.floor((total % 6000) / 100);
  const centi = total % 100;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centi).padStart(2, '0')}`;
}

export function Stopwatch({ theme = 'dark' }: { theme?: 'dark' | 'light' | 'claude' }) {
  const t = useT();
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  // Anchor in real time + accumulated drift-free offset.
  const startedAtRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) {
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = Date.now();
    // Use requestAnimationFrame to keep centisecond display smooth
    // without 31 ms jitter from a slow setInterval.
    let raf = 0;
    const tick = () => {
      if (startedAtRef.current === null) return;
      setMs(baseRef.current + (Date.now() - startedAtRef.current));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [running]);

  const reset = () => {
    setRunning(false);
    setMs(0);
    setLaps([]);
    baseRef.current = 0;
  };

  const lap = () => {
    // Snapshot the CURRENT displayed ms so laps match what user sees
    setLaps((l) => [ms, ...l]);
  };

  const btnHover = theme === 'dark' ? 'hover:bg-white/15' : theme === 'claude' ? 'hover:bg-[#d4b896]/30' : 'hover:bg-black/15';
  const lapMute = theme === 'dark' ? 'opacity-70' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'opacity-80';

  return (
    <div className="flex flex-col gap-3">
      <div className="text-5xl font-thin tabular-nums tracking-tighter">
        {formatTime(ms)}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? t('stopwatch.pause') : t('stopwatch.start')}
          className={`p-2 rounded-full transition-colors ${btnHover}`}
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={reset}
          aria-label={t('common.reset')}
          className={`p-2 rounded-full transition-colors ${btnHover}`}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={lap}
          disabled={!running && ms === 0}
          aria-label={t('stopwatch.recordLap')}
          className={`p-2 rounded-full transition-colors disabled:opacity-30 ${btnHover}`}
        >
          <Flag className="w-4 h-4" />
        </button>
      </div>
      {laps.length > 0 && (
        <div className="max-h-24 overflow-y-auto text-sm space-y-1 mt-1">
          {laps.map((l, i) => (
            <div key={i} className={`flex justify-between tabular-nums ${lapMute}`}>
              <span>#{laps.length - i}</span>
              <span>{formatTime(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
