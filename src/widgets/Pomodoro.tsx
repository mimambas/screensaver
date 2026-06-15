import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export function Pomodoro({ theme = 'dark' }: { theme?: 'dark' | 'light' | 'claude' }) {
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

  const labelClass = theme === 'dark' ? 'text-white/70' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'text-black/70';
  const btnHover = theme === 'dark' ? 'hover:bg-white/10' : theme === 'claude' ? 'hover:bg-[#d4b896]/30' : 'hover:bg-black/10';
  const trackBg = theme === 'dark' ? 'bg-white/15' : theme === 'claude' ? 'bg-[#d4b896]/40' : 'bg-black/15';
  const fillBg = theme === 'dark' ? 'bg-white/70' : theme === 'claude' ? 'bg-[#a87a4a]' : 'bg-black/70';
  const muteSpan = theme === 'dark' ? 'text-white/40' : theme === 'claude' ? 'text-[#3a2e1f]/40' : 'text-black/40';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`text-xs uppercase tracking-widest ${labelClass}`}>
        {mode === 'work' ? 'Focus' : 'Break'}
      </div>
      <div className="text-6xl font-thin tabular-nums tracking-tighter">
        {mm}<span className={muteSpan}>:</span>{ss}
      </div>
      <div className={`w-48 h-1 ${trackBg} rounded-full overflow-hidden`}>
        <div
          className={`h-full ${fillBg} transition-all duration-1000 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => setRunning(!running)}
          className={`p-2 rounded-full transition-colors ${btnHover}`}
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={reset}
          className={`p-2 rounded-full transition-colors ${btnHover}`}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}