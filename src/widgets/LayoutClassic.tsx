// Classic layout — clock at center, all optional widgets stacked
// below in 3 horizontal bands. The canonical screensaver
// arrangement. Reads everything from useSettings().
//
// Widgets in each band are sorted by the user's drag-reorder
// preference (persisted via the ReorderDragProvider / Draggable
// store). The first widget in a band gets the "first" position
// visually; the rest follow. A widget that hasn't been touched
// by the user keeps its default position.

import { DigitalClock, WorldClock, DateDisplay } from './Clock';
import { Stopwatch } from './Stopwatch';
import { Weather } from './Weather';
import { Quotes } from './Quotes';
import { DayProgress } from './DayProgress';
import { AlarmList } from './AlarmList';
import { Timer } from './Timer';
import { Calendar } from './Calendar';
import { Draggable, ReorderDragProvider } from './Draggable';
import { useDraggableOrder } from './draggable-order';
import { lazy, Suspense } from 'react';
import { useSettings } from './settings-context';

// Heavy widgets — code-split. The first paint only needs the
// clock, the layout shell, and the always-on small widgets.
// Pomodoro (charts), Breathing (animation), and Affirmation
// (catalog) each pull in a non-trivial amount of code that
// doesn't need to ship in the initial bundle. The Suspense
// boundary falls back to a 1-line "..." so the user sees no
// layout shift when the chunk loads.
const Pomodoro = lazy(() => import('./Pomodoro').then((m) => ({ default: m.Pomodoro })));
const Breathing = lazy(() => import('./Breathing').then((m) => ({ default: m.Breathing })));
const Affirmation = lazy(() => import('./Affirmation').then((m) => ({ default: m.Affirmation })));

// ── sortByOrder — given a list of widget ids and the persisted
//    order, return a new array sorted to match. Ids that don't
//    appear in the order keep their relative position at the
//    end (stable sort behaviour).
function sortByOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items;
  const idx = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ai = idx.has(a.id) ? idx.get(a.id)! : Number.POSITIVE_INFINITY;
    const bi = idx.has(b.id) ? idx.get(b.id)! : Number.POSITIVE_INFINITY;
    return ai - bi;
  });
}

export function LayoutClassic() {
  const s = useSettings();
  // The reorder hook subscribes to the order store. It returns
  // an empty array until the user has ever dragged something,
  // which means widgets render in their default order.
  const order = useDraggableOrder();

  // Per-band item lists. The order hook reorders within each
  // band independently — there's no cross-band reorder, which
  // would be confusing (a Stopwatch doesn't belong in the
  // weather band).
  const topBand = sortByOrder(
    [
      { id: 'date', el: s.showDate ? <Draggable id="date" theme={s.theme}><DateDisplay theme={s.theme} locale={s.dateLocale} format={s.dateFormat} /></Draggable> : null },
      { id: 'calendar', el: s.showCalendar ? <div className="mt-2"><Draggable id="calendar" theme={s.theme}><Calendar theme={s.theme} locale={s.dateLocale} /></Draggable></div> : null },
      { id: 'worldclock', el: s.showWorldClock ? <Draggable id="worldclock" theme={s.theme}><WorldClock color={s.clockColor} customHex={s.customColor} theme={s.theme} cities={s.worldCities} /></Draggable> : null },
    ],
    order,
  );

  const midBand = sortByOrder(
    [
      { id: 'pomodoro', el: s.showPomodoro ? <Pomodoro theme={s.theme} /> : null },
      { id: 'stopwatch', el: s.showStopwatch ? <Stopwatch theme={s.theme} /> : null },
      { id: 'timer', el: s.showTimer ? <Timer theme={s.theme} /> : null },
      { id: 'breathing', el: s.showBreathing ? <Breathing /> : null },
      { id: 'dayprogress', el: s.showDayProgress ? <DayProgress theme={s.theme} city={s.city} /> : null },
    ],
    order,
  );

  const bottomBand = sortByOrder(
    [
      { id: 'weather', el: s.showWeather ? <Weather theme={s.theme} city={s.city} /> : null },
      { id: 'quote', el: s.showQuote ? <Quotes theme={s.theme} /> : null },
      { id: 'affirmation', el: s.showAffirmation ? <Affirmation theme={s.theme} /> : null },
      { id: 'alarms', el: s.showAlarms ? <AlarmList theme={s.theme} /> : null },
    ],
    order,
  );

  // Filter out null entries (the user toggled off that widget)
  // before rendering. The sortByOrder call above includes
  // toggled-off widgets so the order "remembers" them — if the
  // user re-enables a widget it lands back at the position they
  // last had it.
  const renderBand = (band: Array<{ id: string; el: React.ReactNode }>) =>
    band.filter((b) => b.el !== null).map((b) => (
      <div key={b.id}>
        <Suspense fallback={<div className="opacity-50 text-[10px]">...</div>}>
          {b.el}
        </Suspense>
      </div>
    ));

  return (
    <ReorderDragProvider>
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 gap-8">
        <DigitalClock
          style={s.clockStyle}
          color={s.clockColor}
          customHex={s.customColor}
          size={s.clockSize}
          soundEnabled={s.flipSound}
          theme={s.theme}
        />
        {renderBand(topBand)}
        {(s.showPomodoro || s.showStopwatch || s.showDayProgress || s.showTimer || s.showBreathing) && (
          <div className="flex flex-wrap items-start justify-center gap-12 mt-2">
            {renderBand(midBand)}
          </div>
        )}
        {(s.showWeather || s.showQuote || s.showAlarms || s.showAffirmation) && (
          <div className="flex flex-col items-center gap-4 mt-2 w-full max-w-md">
            {renderBand(bottomBand)}
          </div>
        )}
      </div>
    </ReorderDragProvider>
  );
}
