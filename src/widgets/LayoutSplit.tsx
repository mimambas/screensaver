// Split layout — three columns: time | tools | info. The vertical
// separators make it feel like a workstation, not a screensaver.
// Useful when the user wants to glance at the side panels.

import { DigitalClock, WorldClock, DateDisplay } from './Clock';
import { Pomodoro } from './Pomodoro';
import { Stopwatch } from './Stopwatch';
import { Weather } from './Weather';
import { Quotes } from './Quotes';
import { DayProgress } from './DayProgress';
import { AlarmList } from './AlarmList';
import { Timer } from './Timer';
import { Calendar } from './Calendar';
import { Breathing } from './Breathing';
import { Affirmation } from './Affirmation';
import { useSettings } from './settings-context';

export function LayoutSplit() {
  const s = useSettings();
  return (
    <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-3 gap-6 p-12">
      {/* Left: time */}
      <div className="flex flex-col items-center justify-center gap-6 border-r border-white/10 pr-6">
        <DigitalClock
          style={s.clockStyle}
          color={s.clockColor}
          customHex={s.customColor}
          size={s.clockSize}
          soundEnabled={s.flipSound}
          theme={s.theme}
        />
        {s.showDate && <DateDisplay theme={s.theme} locale={s.dateLocale} format={s.dateFormat} />}
        {s.showCalendar && (
          <div className="mt-2">
            <Calendar theme={s.theme} locale={s.dateLocale} />
          </div>
        )}
        {s.showWorldClock && (
          <WorldClock color={s.clockColor} customHex={s.customColor} theme={s.theme} cities={s.worldCities} />
        )}
        {s.showDayProgress && <DayProgress theme={s.theme} city={s.city} />}
      </div>

      {/* Center: tools */}
      <div className="flex flex-col items-center justify-center gap-8 border-r border-white/10 pr-6">
        {s.showPomodoro && <Pomodoro theme={s.theme} />}
        {s.showStopwatch && <Stopwatch theme={s.theme} />}
        {s.showTimer && <Timer theme={s.theme} />}
        {s.showBreathing && <Breathing theme={s.theme} />}
        {s.showAlarms && <AlarmList theme={s.theme} />}
      </div>

      {/* Right: info */}
      <div className="flex flex-col items-start justify-center gap-6">
        {s.showWeather && <Weather theme={s.theme} city={s.city} />}
        {s.showQuote && <Quotes theme={s.theme} />}
        {s.showAffirmation && <Affirmation theme={s.theme} />}
      </div>
    </div>
  );
}
