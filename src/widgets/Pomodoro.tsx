import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export function Pomodoro() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          // auto toggle mode
          if (mode === 'work') {
            setMode('break');
            return 5 * 60;
          } else {
            setMode('work');
            return 25 * 60;
          }
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  const reset = () => {
    setRunning(false);
    setMode('work');
    setSeconds(25 * 60);
  };

  const progress = mode === 'work'
    ? ((25 * 60 - seconds) / (25 * 60)) * 100
    : ((5 * 60 - seconds) / (5 * 60)) * 100;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-xs uppercase tracking-widest opacity-50">
        {mode === 'work' ? 'Focus' : 'Break'}
      </div>
      <div className="text-6xl font-thin tabular-nums tracking-tighter">
        {mm}<span className="opacity-30">:</span>{ss}
      </div>
      <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-white/60 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex gap-2 mt-1">
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
      </div>
    </div>
  );
}