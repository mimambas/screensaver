// Casio F-91W port — based on dundalek/casio-f91w-fsm (MIT). The
// reference SVG (`/casio-f91w.svg`) has fixed green LCD segments;
// we tint via CSS hue-rotate so the chosen clockColor matches.
// Loaded lazily by Clock.tsx — the state machine + SVG embed + key
// bindings add ~5KB and most users don't pick "casio".

import { useEffect, useMemo, useRef } from 'react';
import { getSizeScale, type ClockColor, type ClockSize } from './clock-constants';
import { useCasioState, type CasioHandle } from './use-casio-state';

// Mirror of the segment table from the reference's
// CasioF91WDigitalDisplay.js — 7/8/9-seg sets per char.
const SEG7: Record<string, string[]> = {
  '0': ['A', 'B', 'C', 'D', 'E', 'F'],
  '1': ['B', 'C'],
  '2': ['A', 'B', 'D', 'E', 'G'],
  '3': ['A', 'B', 'C', 'D', 'G'],
  '4': ['B', 'C', 'F', 'G'],
  '5': ['A', 'C', 'D', 'F', 'G'],
  '6': ['A', 'C', 'D', 'E', 'F', 'G'],
  '7': ['A', 'B', 'C'],
  '8': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  '9': ['A', 'B', 'C', 'D', 'F', 'G'],
  A: ['A', 'B', 'C', 'E', 'F', 'G'],
  C: ['A', 'D', 'E', 'F'],
  E: ['A', 'D', 'E', 'F', 'G'],
  F: ['A', 'E', 'F', 'G'],
  H: ['B', 'C', 'E', 'F', 'G'],
  I: ['B', 'C'],
  L: ['D', 'E', 'F'],
  O: ['A', 'B', 'C', 'D', 'E', 'F'],
  S: ['A', 'C', 'D', 'F', 'G'],
  U: ['B', 'C', 'D', 'E', 'F'],
  ' ': [],
};
const SEG8: Record<string, string[]> = {
  ...SEG7,
  T: ['A', 'E', 'F', 'H'],
  R: ['A', 'B', 'C', 'E', 'F', 'G', 'H'],
};
const SEG9: Record<string, string[]> = {
  ...SEG8,
  M: ['A', 'B', 'C', 'E', 'F', 'H', 'I'],
  W: ['B', 'C', 'D', 'E', 'F', 'H', 'I'],
};

// Map clockColor → CSS hue-rotate degrees. The reference SVG has its
// LCD filled with a green gradient; we shift the hue so the chosen
// clockColor tints the entire LCD panel. The case/buttons are mostly
// greys so they shift less noticeably.
function getCasioTintFilter(color: ClockColor): number | null {
  switch (color) {
    case 'white':
    case 'ink':
      return null; // default green stays as-is
    case 'amber':
      return -55; // green → amber
    case 'green':
      return 0; // already green
    case 'cyan':
      return -120; // green → cyan
    case 'red':
      return 120; // green → red (complementary)
    case 'pink':
      return -160; // green → magenta/pink
    default:
      return null;
  }
}

export function CasioClock({
  color,
  customHex,
  now,
  size: sizeProp,
}: {
  color: ClockColor;
  customHex?: string;
  now: Date;
  size?: ClockSize;
}) {
  // Reference SVG is 1480x1311. We render it at scale, preserving
  // the original aspect ratio (≈ 1.13). The original is large on
  // purpose so the segments are crisp; we don't apply any transforms.
  const scale = getSizeScale(sizeProp);
  const W = 1480 * scale * 0.27; // ≈400 at scale=1
  const H = 1311 * scale * 0.27; // ≈354 at scale=1

  // Live state machine + flags. Press L/C/A to navigate.
  const casio = useCasioState();

  // Compute the per-display characters, exactly like the reference's
  // OS does. Different menus use different digit fields. The
  // stopwatch increments out-of-band (via setInterval inside the
  // hook) so we read stopwatchMs into a primitive for the dep array;
  // ESLint otherwise flags it as a property access.
  const { stopwatchMs: _stopwatchMs } = casio;
  const visibility = useMemo(() => {
    return computeCasioVisibility(casio, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casio, now, _stopwatchMs]);

  // Keyboard bindings: Q/W/E/F → L/A (both W and E for left-hand
  // friendliness) / C. Top-row QWEF mirrors the physical watch's
  // button positions reasonably.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'q') casio.pressL();
      else if (k === 'w' || k === 'e') casio.pressA();
      else if (k === 'f') casio.pressC();
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'q') casio.releaseL();
      else if (k === 'w' || k === 'e') casio.releaseA();
      else if (k === 'f') casio.releaseC();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [casio]);

  // Tint the LCD via CSS hue-rotate. The reference SVG has fixed
  // green LCD segments; hue-rotate lets us shift the hue to match
  // the user's chosen clockColor while keeping the case/buttons grey.
  // When a custom HEX is set we skip the hue-rotate; the case/buttons
  // stay in their natural grey, the LCD stays green. Tinting a
  // specific RGB value would need per-element recoloring which we
  // skip here for the sake of bundle size.
  const tint = customHex ? null : getCasioTintFilter(color);

  return (
    <div
      style={{
        width: W,
        height: H,
        position: 'relative',
        filter: tint ? `hue-rotate(${tint}deg)` : undefined,
      }}
    >
      <CasioSvgEmbed visibility={visibility} />
      <CasioButtonOverlay
        handle={casio}
        W={W}
        H={H}
        scale={scale}
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// CasioButtonOverlay — transparent clickable areas over the SVG so the
// user can press L / C / A with the mouse. Matches the button positions
// in the reference (L = top-left, C = bottom-left, A = right).
// --------------------------------------------------------------------------

function CasioButtonOverlay({
  handle,
  W,
  H,
  scale,
}: {
  handle: CasioHandle;
  W: number;
  H: number;
  scale: number;
}) {
  const btnW = 30 * scale * 0.5;
  const btnH = 70 * scale * 0.5;
  const lX = (104 / 1480) * W - btnW / 2;
  const cX = (104 / 1480) * W - btnW / 2;
  const aX = (1330 / 1480) * W - btnW / 2;
  const lY = (477 / 1311) * H - btnH / 2;
  const cY = (777 / 1311) * H - btnH / 2;
  const aY = (777 / 1311) * H - btnH / 2;

  const button = (label: string, x: number, y: number) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={() => {
        if (label === 'L') handle.pressL();
        else if (label === 'A') handle.pressA();
        else handle.pressC();
      }}
      onPointerUp={() => {
        if (label === 'L') handle.releaseL();
        else if (label === 'A') handle.releaseA();
        else handle.releaseC();
      }}
      onPointerLeave={() => {
        if (label === 'A') handle.releaseA();
        else if (label === 'L') handle.releaseL();
        else handle.releaseC();
      }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: btnW,
        height: btnH,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
    />
  );

  return (
    <>
      {button('L', lX, lY)}
      {button('C', cX, cY)}
      {button('A', aX, aY)}
    </>
  );
}

// --------------------------------------------------------------------------
// computeCasioVisibility — port of the reference's _updateClockValues
// logic for each menu. Returns the per-element visibility set the
// CasioSvgEmbed applies to the SVG.
// --------------------------------------------------------------------------

function computeCasioVisibility(
  casio: CasioHandle,
  now: Date,
): {
  chars: Record<string, string>;
  flags: Record<string, boolean>;
} {
  const { state, flags, stopwatchMs, alarmTime, dateTimeOffset } = casio;
  const effectiveNow = new Date(now.getTime() + dateTimeOffset);
  const hours = effectiveNow.getHours();
  const minutes = effectiveNow.getMinutes();
  const seconds = effectiveNow.getSeconds();
  const displayHours = flags.timeMode12
    ? hours > 12
      ? hours - 12
      : hours
    : hours;
  const dayLetters = effectiveNow
    .toLocaleDateString('en-US', { weekday: 'long' })
    .slice(0, 2)
    .toUpperCase();
  const dayNum = effectiveNow.getDate();
  const pad2 = (n: number) => String(n).padStart(2, '0');

  const hh1 = displayHours >= 10 ? String(Math.floor(displayHours / 10)) : ' ';
  const hh2 = String(displayHours % 10);
  const mm1 = pad2(minutes)[0];
  const mm2 = pad2(minutes)[1];
  const ss1 = pad2(seconds)[0];
  const ss2 = pad2(seconds)[1];
  const d1 = dayNum >= 10 ? String(Math.floor(dayNum / 10)) : ' ';
  const d2 = String(dayNum % 10);

  const baseFlags = {
    alarmOnMark: flags.alarmOn,
    timeSignalOnMark: flags.hourlyChime,
    timeMode12: flags.timeMode12,
    timeMode24: !flags.timeMode12,
    lap: false,
    dots: true,
    light: flags.light,
  };

  if (state.menu === 'dateTime') {
    if (state.action === 'casio') {
      return {
        chars: {
          mode_2: 'C', mode_1: 'A',
          day_2: '5', day_1: '1',
          hour_2: '0', hour_1: ' ',
          minute_2: ' ', minute_1: ' ',
          second_2: ' ', second_1: ' ',
        },
        flags: { ...baseFlags, dots: false },
      };
    }
    return {
      chars: {
        mode_2: dayLetters[0], mode_1: dayLetters[1],
        day_2: d1, day_1: d2,
        hour_2: hh1, hour_1: hh2,
        minute_2: mm1, minute_1: mm2,
        second_2: ss1, second_1: ss2,
      },
      flags: baseFlags,
    };
  }

  if (state.menu === 'dailyAlarm') {
    const alarmH = alarmTime.getHours();
    const alarmM = alarmTime.getMinutes();
    const aH1 = alarmH >= 10 ? String(Math.floor(alarmH / 10)) : '0';
    const aH2 = String(alarmH % 10);
    return {
      chars: {
        mode_2: 'A', mode_1: 'L',
        day_2: ' ', day_1: ' ',
        hour_2: aH1, hour_1: aH2,
        minute_2: alarmM >= 10 ? String(Math.floor(alarmM / 10)) : '0',
        minute_1: String(alarmM % 10),
        second_2: ' ', second_1: ' ',
      },
      flags: { ...baseFlags, dots: state.action === 'default' },
    };
  }

  if (state.menu === 'stopwatch') {
    const totalMs = Math.floor(stopwatchMs);
    const m = Math.floor(totalMs / 60_000);
    const s = Math.floor((totalMs % 60_000) / 1000);
    const cs = Math.floor((totalMs % 1000) / 10); // hundredths of a second
    return {
      chars: {
        mode_2: 'S', mode_1: 'T',
        day_2: ' ', day_1: ' ',
        hour_2: m > 9 ? String(Math.floor(m / 10)) : ' ',
        hour_1: String(m % 10),
        minute_2: s >= 10 ? String(Math.floor(s / 10)) : '0',
        minute_1: String(s % 10),
        second_2: String(Math.floor(cs / 10)),
        second_1: String(cs % 10),
      },
      flags: { ...baseFlags, lap: state.action === 'modified' },
    };
  }

  // setDateTime — show time/date, but blink the field being edited.
  const blink = (v: string, on: boolean) => (on ? ' ' : v);
  const blinkHour1 = state.action === 'edit-hours' ? blink(hh2, true) : hh2;
  const blinkHour2 = state.action === 'edit-hours' ? blink(hh1, true) : hh1;
  const blinkMin1 = state.action === 'edit-minutes' ? blink(mm2, true) : mm2;
  const blinkMin2 = state.action === 'edit-minutes' ? blink(mm1, true) : mm1;
  const dayChars =
    state.action === 'edit-day-number' ? [' ', ' '] : [d1, d2];
  return {
    chars: {
      mode_2: dayLetters[0], mode_1: dayLetters[1],
      day_2: dayChars[0], day_1: dayChars[1],
      hour_2: blinkHour2, hour_1: blinkHour1,
      minute_2: blinkMin2, minute_1: blinkMin1,
      second_2: ' ', second_1: ' ',
    },
    flags: { ...baseFlags, dots: state.action === 'default' },
  };
}

// --------------------------------------------------------------------------
// CasioSvgEmbed — embeds the reference SVG and applies per-element
// opacity on mount and on every prop change. We use a static <object>
// (not <img>) so we can traverse the inner DOM and call
// displayScreen() — the same function the reference uses.
// --------------------------------------------------------------------------

function CasioSvgEmbed({
  visibility,
}: {
  visibility: {
    chars: Record<string, string>;
    flags: Record<string, boolean>;
  };
}) {
  const objectRef = useRef<HTMLObjectElement | null>(null);
  const scale = getSizeScale(1.0); // SVG handles its own scaling via width/height

  // Apply visibility whenever it changes. Re-fetched via the embedded
  // document (object loads the SVG, same-origin so we can reach in).
  useEffect(() => {
    const obj = objectRef.current;
    if (!obj) return;
    const apply = () => {
      const doc = obj.contentDocument;
      if (!doc) return;
      const root = doc.getElementById('CasioF91WSVG');
      if (!root) return;

      const displays: Record<string, number> = {
        mode_2: 9, mode_1: 8, day_2: 7, day_1: 7,
        hour_2: 7, hour_1: 7, minute_2: 7, minute_1: 7,
        second_2: 7, second_1: 7,
      };
      const tables: Record<number, Record<string, string[]>> = { 7: SEG7, 8: SEG8, 9: SEG9 };
      for (const [id, char] of Object.entries(visibility.chars)) {
        const segs = displays[id];
        const table = tables[segs];
        const on = (table[char] ?? table[' '] ?? []) as string[];
        for (const seg of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
          const el = root.querySelector('#' + id + '_' + seg);
          if (el) el.setAttribute('opacity', on.includes(seg) ? '1' : '0');
        }
      }

      for (const [id, on] of Object.entries(visibility.flags)) {
        const el = root.querySelector('#' + id);
        if (el) el.setAttribute('opacity', on ? '1' : '0');
      }
    };

    if (obj.contentDocument && obj.contentDocument.getElementById('CasioF91WSVG')) {
      apply();
    } else {
      obj.addEventListener('load', apply, { once: true });
    }
  }, [visibility, scale]);

  return (
    <object
      ref={objectRef}
      type="image/svg+xml"
      data="/casio-f91w.svg"
      aria-label="Casio F-91W"
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
