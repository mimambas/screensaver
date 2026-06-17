// Calendar widget — month grid with current-day highlight, prev/next
// month navigation. We render directly in the user's locale so weekday
// names match the rest of the app.

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ThemeName } from './clock-constants';
import { useT } from '../i18n';

export function Calendar({
  theme = 'dark',
  locale = 'en-US',
}: {
  theme?: ThemeName;
  locale?: string;
}) {
  const t = useT();
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Re-anchor 'today' at midnight so the highlight stays correct
  // even if the page is left open across a day boundary. We track
  // the day-of-month in a primitive so the deps array stays
  // statically analyzable.
  const today = now.getDate();
  useEffect(() => {
    const ms = (24 * 60 - new Date().getMinutes()) * 60_000 - new Date().getSeconds() * 1000;
    const id = window.setTimeout(() => {
      setNow(new Date());
      const d = new Date();
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }, ms);
    return () => window.clearTimeout(id);
  }, [today]);

  // Locale-aware weekday labels (Sun..Sat or Mon..Sun).
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i); // a known Sunday
    return d.toLocaleDateString(locale, { weekday: 'narrow' });
  });
  // The Intl calendar treats Sunday as the first day of the week in
  // many locales (en-US), but Monday in others (id-ID, most of EU).
  // Detect by asking Intl for the first day of the week.
  const localeObj = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay?: number } };
  const weekInfo = localeObj.getWeekInfo?.();
  const firstDay = weekInfo?.firstDay === 7 ? 0 : weekInfo?.firstDay ?? 0; // 0=Sun..6=Sat
  const orderedWeekdays = [
    ...weekdays.slice(firstDay),
    ...weekdays.slice(0, firstDay),
  ];

  // Build the grid: leading days from prev month + current month +
  // trailing days from next month, always 6 rows × 7 cols = 42 cells.
  const firstOfMonth = new Date(view.year, view.month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const daysInPrevMonth = new Date(view.year, view.month, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  // Leading
  for (let i = startWeekday - firstDay; i < startWeekday - firstDay + firstDay - firstDay; i++) {
    // placeholder — loop below
  }
  // Cleaner: compute absolute offset of first cell (col 0 = firstDay)
  const leadingCount = (startWeekday - firstDay + 7) % 7;
  for (let i = 0; i < leadingCount; i++) {
    const d = new Date(view.year, view.month - 1, daysInPrevMonth - leadingCount + i + 1);
    cells.push({ date: d, inMonth: false });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ date: new Date(view.year, view.month, i), inMonth: true });
  }
  // Trailing
  while (cells.length < 42) {
    const idx = cells.length - leadingCount - daysInMonth + 1;
    const d = new Date(view.year, view.month + 1, idx);
    cells.push({ date: d, inMonth: false });
  }

  const isToday = (d: Date) =>
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const isDark = theme === 'dark';
  const isClaude = theme === 'claude';
  const label = isDark ? 'text-white/60' : isClaude ? 'text-[#3a2e1f]/60' : 'text-black/60';
  const dim = isDark ? 'text-white/30' : isClaude ? 'text-[#3a2e1f]/30' : 'text-black/30';
  const hover = isDark ? 'hover:bg-white/10' : isClaude ? 'hover:bg-[#f0e6d2]' : 'hover:bg-black/10';
  const todayBg = isDark ? 'bg-white/30 text-white' : isClaude ? 'bg-[#a87a4a] text-white' : 'bg-black/80 text-white';
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className={`inline-block rounded-2xl border p-3 ${
        isDark
          ? 'bg-white/5 border-white/10'
          : isClaude
          ? 'bg-[#e8dcc4]/40 border-[#3a2e1f]/15'
          : 'bg-black/5 border-black/10'
      }`}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          type="button"
          onClick={() => {
            const d = new Date(view.year, view.month - 1, 1);
            setView({ year: d.getFullYear(), month: d.getMonth() });
          }}
          aria-label={t('calendar.prevMonth')}
          className={`p-1 rounded ${hover}`}
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <div className={`text-xs font-medium ${label}`}>{monthLabel}</div>
        <button
          type="button"
          onClick={() => {
            const d = new Date(view.year, view.month + 1, 1);
            setView({ year: d.getFullYear(), month: d.getMonth() });
          }}
          aria-label={t('calendar.nextMonth')}
          className={`p-1 rounded ${hover}`}
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className={`grid grid-cols-7 gap-0.5 text-[10px] text-center mb-1 ${label}`}>
        {orderedWeekdays.map((w, i) => (
          <div key={i} className="py-0.5 opacity-70">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[11px]">
        {cells.map((c, i) => (
          <div
            key={i}
            className={`aspect-square flex items-center justify-center rounded ${
              isToday(c.date) ? todayBg : c.inMonth ? `${hover} cursor-default` : `cursor-default ${dim}`
            }`}
          >
            {c.date.getDate()}
          </div>
        ))}
      </div>
    </div>
  );
}
