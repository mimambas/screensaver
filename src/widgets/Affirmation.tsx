// Daily affirmation widget — like Quotes but the catalog is
// category-tagged and we deterministically pick one per day so the
// same user sees the same affirmation all day. On midnight rollover
// (we use the same trick as the Date widget) the pick changes.
//
// Three categories: motivational, calm, stoic. The user picks one
// (or "all" for a daily mix). Persisted under
// `screensaver.affirmation.v1` with the category + the date-key of
// the last rotation, so we only reshuffle when the day flips.

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { ThemeName } from './clock-constants';
import { THEMES } from './theme-presets';
import { useT } from '../i18n';

type Category = 'motivational' | 'calm' | 'stoic';

const AFFIRMATIONS: Record<Category, string[]> = {
  motivational: [
    'You are capable of far more than you think.',
    'The work you do today plants seeds for tomorrow.',
    'Small steps still move you forward.',
    'Done is better than perfect.',
    'Your effort compounds — keep going.',
    'You don\'t have to feel ready to begin.',
    'Progress, not perfection.',
    'What you do now is shaping who you become.',
  ],
  calm: [
    'Breathe. You are exactly where you need to be.',
    'Peace is found in the present moment.',
    'Let go of what you cannot control.',
    'This moment is enough.',
    'You are safe, you are here, you are okay.',
    'Soften your shoulders. Unclench your jaw.',
    'Quiet is a kind of strength.',
    'There is no rush.',
  ],
  stoic: [
    'Focus on what is yours to do — the rest is noise.',
    'Obstacles are the path.',
    'You suffer more in imagination than in reality.',
    'The obstacle in the path becomes the path.',
    'How we respond is ours. The rest is not.',
    'Begin again. Again. Again.',
    'Discipline equals freedom.',
    'Memento mori — remember you will die. So begin.',
  ],
};

const STORAGE_KEY = 'screensaver.affirmation.v1';

type Persisted = { v: 1; category: Category | 'all'; dateKey: string; idx: number };

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadState(): Persisted {
  if (typeof window === 'undefined') {
    return { v: 1, category: 'all', dateKey: todayKey(), idx: 0 };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { v: 1, category: 'all', dateKey: todayKey(), idx: 0 };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (parsed.v !== 1 || typeof parsed.dateKey !== 'string' || typeof parsed.idx !== 'number') {
      return { v: 1, category: 'all', dateKey: todayKey(), idx: 0 };
    }
    return {
      v: 1,
      category: (parsed.category as Category | 'all') ?? 'all',
      dateKey: parsed.dateKey,
      idx: parsed.idx,
    };
  } catch {
    return { v: 1, category: 'all', dateKey: todayKey(), idx: 0 };
  }
}

function saveState(s: Persisted) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function pickFor(category: Category | 'all', seed: string): { text: string; cat: Category } {
  // Deterministic pick: hash the seed into a bucket. Two users
  // opening the app the same day see the same affirmation (nice for
  // shared screenshots). We rotate via seed = dateKey + category.
  const cats: Category[] = category === 'all'
    ? ['motivational', 'calm', 'stoic']
    : [category];
  // Pick the category index by hash, then the affirmation by hash.
  const hash = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  const cat = cats[hash % cats.length];
  const list = AFFIRMATIONS[cat];
  const idx = Math.floor(hash / cats.length) % list.length;
  return { text: list[idx], cat };
}

export function Affirmation({ theme = 'dark' }: { theme?: ThemeName }) {
  const t = useT();
  const palette = THEMES[theme];
  const initial = loadState();
  const [category, setCategory] = useState<Category | 'all'>(initial.category);
  const [dateKey, setDateKey] = useState(initial.dateKey);
  const [idx, setIdx] = useState(initial.idx);

  // Re-anchor at the next local midnight, same trick as Date.
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const ms = nextMidnight.getTime() - now.getTime();
    const id = window.setTimeout(() => {
      setDateKey(todayKey());
    }, ms);
    return () => window.clearTimeout(id);
  }, [dateKey]);

  // Persist on every change.
  useEffect(() => {
    saveState({ v: 1, category, dateKey, idx });
  }, [category, dateKey, idx]);

  // Pick deterministically per day + category. Storing idx is
  // optional (we always recompute) but lets us persist the "next"
  // pick if the user navigates categories.
  const picked = pickFor(category, dateKey + category);

  const catLabel =
    picked.cat === 'motivational' ? t('affirmation.cat.motivational') :
    picked.cat === 'calm' ? t('affirmation.cat.calm') :
    t('affirmation.cat.stoic');

  return (
    <div className={`flex flex-col items-center gap-2 max-w-xl text-center px-4 transition-colors duration-700 ${palette.text}`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest ${palette.textFaint}`}>
        <Sparkles className="w-3 h-3" /> {t('affirmation.title')} · {catLabel}
      </div>
      <div className="text-lg font-light leading-relaxed italic">
        {picked.text}
      </div>
      <div className="flex gap-1 text-[10px] mt-1">
        {(['all', 'motivational', 'calm', 'stoic'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCategory(c);
              setIdx(0);
            }}
            aria-pressed={category === c}
            data-category={c}
            className={`px-2 py-0.5 rounded-full transition-colors ${
              category === c
                ? theme === 'claude' ? 'bg-[#3a2e1f]/15 text-[#3a2e1f]' : `${palette.surface} ${palette.text}`
                : `${palette.textFaint} ${palette.surfaceHover}`
            }`}
          >
            {c === 'all' ? t('affirmation.cat.all') :
             c === 'motivational' ? t('affirmation.cat.motivational') :
             c === 'calm' ? t('affirmation.cat.calm') :
             t('affirmation.cat.stoic')}
          </button>
        ))}
      </div>
    </div>
  );
}
