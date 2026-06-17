// Minimal layout — clock only, full attention to the time. No
// widgets, no chrome. The classic "midnight oil" setup.

import { DigitalClock } from './Clock';
import { useSettings } from './settings-context';

export function LayoutMinimal() {
  const s = useSettings();
  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
      <DigitalClock
        style={s.clockStyle}
        color={s.clockColor}
        customHex={s.customColor}
        size={s.clockSize}
        soundEnabled={s.flipSound}
        theme={s.theme}
      />
    </div>
  );
}
