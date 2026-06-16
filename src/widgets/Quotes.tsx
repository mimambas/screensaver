import { useEffect, useState } from 'react';
import { Quote as QuoteIcon } from 'lucide-react';

const QUOTES: { text: string; author: string }[] = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
  { text: 'Stay hungry, stay foolish.', author: 'Stewart Brand' },
  { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
  { text: 'Code is read much more often than it is written.', author: 'Guido van Rossum' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
  { text: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.', author: 'Antoine de Saint-Exupéry' },
  { text: 'Programs must be written for people to read.', author: 'Harold Abelson' },
  { text: 'The best error message is the one that never shows up.', author: 'Thomas Fuchs' },
  { text: 'Premature optimization is the root of all evil.', author: 'Donald Knuth' },
  { text: 'Walk as if you are kissing the Earth with your feet.', author: 'Thich Nhat Hanh' },
];

const STORAGE_KEY = 'screensaver.quote.idx';

function loadIdx(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return Math.floor(Math.random() * QUOTES.length);
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n < QUOTES.length ? n : 0;
  } catch {
    return 0;
  }
}

function pickNext(prev: number): number {
  if (QUOTES.length <= 1) return 0;
  // Avoid repeating the same quote twice in a row.
  let n = Math.floor(Math.random() * QUOTES.length);
  if (n === prev) n = (n + 1) % QUOTES.length;
  return n;
}

export function Quotes({ theme = 'dark', rotateMs = 30_000 }: { theme?: 'dark' | 'light' | 'claude'; rotateMs?: number }) {
  const [idx, setIdx] = useState(loadIdx);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIdx((prev) => {
          const next = pickNext(prev);
          try { window.localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
          return next;
        });
        setVisible(true);
      }, 400); // fade-out then swap
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [rotateMs]);

  const q = QUOTES[idx];
  const label =
    theme === 'dark' ? 'opacity-50' : theme === 'claude' ? 'text-[#3a2e1f]/50' : 'opacity-50';

  return (
    <div
      className="max-w-xl text-center px-6 transition-opacity duration-400"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <QuoteIcon className="w-5 h-5 mx-auto opacity-30 mb-3" />
      <div className="text-xl font-light leading-relaxed italic">"{q.text}"</div>
      <div className={`text-sm mt-3 ${label}`}>— {q.author}</div>
    </div>
  );
}
