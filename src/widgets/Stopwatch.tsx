import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Flag } from 'lucide-react';

export function Stopwatch() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);

  useEffect(() => {
    if (!running) return;
    const start = Date.now() - ms;
    const id = setInterval(() => setMs(Date.now() - start), 31);
    return () => clearInterval(id);
  }, [running]);

  const formatTime = (ms: number) => {
    const total = Math.floor(ms / 10);
    const minutes = Math.floor(total / 6000);
    const seconds = Math.floor((total % 6000) / 100);
    const centi = total % 100;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centi).padStart(2, '0')}`;
  };

  const reset = () => {
    setMs(0);
    setLaps([]);
    setRunning(false);
  };

  const lap = () => {
    setLaps((l) => [ms, ...l]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-5xl font-thin tabular-nums tracking-tighter">
        {formatTime(ms)}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setRunning(!running)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={reset}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={lap}
          disabled={!running}
          className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
        >
          <Flag className="w-4 h-4" />
        </button>
      </div>
      {laps.length > 0 && (
        <div className="max-h-24 overflow-y-auto text-sm space-y-1 mt-1">
          {laps.map((l, i) => (
            <div key={i} className="flex justify-between opacity-60 tabular-nums">
              <span>#{laps.length - i}</span>
              <span>{formatTime(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}