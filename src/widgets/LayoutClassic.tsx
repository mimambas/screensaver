// Classic layout — clock at center, all optional widgets stacked
// below in 3 horizontal bands. The canonical screensaver
// arrangement. Reads everything from useSettings().

import { DigitalClock, WorldClock, DateDisplay } from './Clock';
import { Pomodoro } from './Pomodoro';
import { Stopwatch } from './Stopwatch';
import { Weather } from './Weather';
import { Quotes } from './Quotes';
import { DayProgress } from './DayProgress';
import { AlarmList } from './AlarmList';
import { Timer } from './Timer';
import { Calendar } from './Calendar';
import { Draggable } from './Draggable';
import { Breathing } from './Breathing';
import { Affirmation } from './Affirmation';
import { useSettings } from './settings-context';

export function LayoutClassic() {
  const s = useSettings();
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 gap-8">
      <DigitalClock
        style={s.clockStyle}
        color={s.clockColor}
        customHex={s.customColor}
        size={s.clockSize}
        soundEnabled={s.flipSound}
        theme={s.theme}
      />
      {s.showDate && (
        <Draggable id="date" theme={s.theme}>
          <DateDisplay theme={s.theme} locale={s.dateLocale} format={s.dateFormat} />
        </Draggable>
      )}
      {s.showCalendar && (
        <div className="mt-2">
          <Draggable id="calendar" theme={s.theme}>
            <Calendar theme={s.theme} locale={s.dateLocale} />
          </Draggable>
        </div>
      )}
      {s.showWorldClock && (
        <Draggable id="worldclock" theme={s.theme}>
          <WorldClock color={s.clockColor} customHex={s.customColor} theme={s.theme} cities={s.worldCities} />
        </Draggable>
      )}

      {(s.showPomodoro || s.showStopwatch || s.showDayProgress || s.showTimer || s.showBreathing) && (
        <div className="flex flex-wrap items-start justify-center gap-12 mt-2">
          {s.showPomodoro && <Pomodoro theme={s.theme} />}
          {s.showStopwatch && <Stopwatch theme={s.theme} />}
          {s.showTimer && <Timer theme={s.theme} />}
          {s.showBreathing && <Breathing theme={s.theme} />}
          {s.showDayProgress && <DayProgress theme={s.theme} city={s.city} />}
        </div>
      )}

      {(s.showWeather || s.showQuote || s.showAlarms || s.showAffirmation) && (
        <div className="flex flex-col items-center gap-4 mt-2 w-full max-w-md">
          {s.showWeather && <Weather theme={s.theme} city={s.city} />}
          {s.showQuote && <Quotes theme={s.theme} />}
          {s.showAffirmation && <Affirmation theme={s.theme} />}
          {s.showAlarms && <AlarmList theme={s.theme} />}
        </div>
      )}
    </div>
  );
}
