import { useEffect, useState } from 'react';
import { Quote as QuoteIcon } from 'lucide-react';
import type { ThemeName } from './clock-constants';
import { THEMES } from './theme-presets';

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

// Schema-versioned storage. v1 was just the index — if the catalog
// grew/shrunk since the user last opened the app, a stale index
// could point at a quote that no longer exists (or wrap around
// and re-show the same quote more often). v2 stores both the index
// AND the catalog length, so we can detect a mismatch and reset.
const STORAGE_KEY = 'screensaver.quote.idx.v2';

type Persisted = { v: 2; idx: number; len: number };

function loadIdx(): number {
  if (typeof window === 'undefined') return Math.floor(Math.random() * QUOTES.length);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return Math.floor(Math.random() * QUOTES.length);
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    // Mismatch (older shape or stale length) → start fresh.
    if (
      parsed.v !== 2 ||
      typeof parsed.idx !== 'number' ||
      typeof parsed.len !== 'number' ||
      parsed.len !== QUOTES.length ||
      parsed.idx < 0 ||
      parsed.idx >= QUOTES.length
    ) {
      return Math.floor(Math.random() * QUOTES.length);
    }
    return parsed.idx;
  } catch {
    return 0;
  }
}

function saveIdx(idx: number) {
  try {
    const payload: Persisted = { v: 2, idx, len: QUOTES.length };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function pickNext(prev: number): number {
  if (QUOTES.length <= 1) return 0;
  // Avoid repeating the same quote twice in a row.
  let n = Math.floor(Math.random() * QUOTES.length);
  if (n === prev) n = (n + 1) % QUOTES.length;
  return n;
}

export function Quotes({ theme = 'dark', rotateMs = 30_000 }: { theme?: ThemeName; rotateMs?: number }) {
  const [idx, setIdx] = useState(loadIdx);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIdx((prev) => {
          const next = pickNext(prev);
          saveIdx(next);
          return next;
        });
        setVisible(true);
      }, 400); // fade-out then swap
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [rotateMs]);

  const q = QUOTES[idx];
  const label = THEMES[theme].textMuted;

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
