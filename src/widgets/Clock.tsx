import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CITIES,
  effectiveClockColor,
  getColor,
  getSizeScale,
  safeDarkBgColor,
} from './clock-constants';
import { playClack, unlockAudio } from './audio';
import type { ClockColor, ClockSize, ClockStyle, ThemeName } from './clock-constants';
import { useCasioState, type CasioHandle } from './use-casio-state';

// --------------------------------------------------------------------------
// Top-level DigitalClock
// --------------------------------------------------------------------------

export function DigitalClock({
  style = 'digital',
  color = 'white',
  theme = 'dark',
  size = 'md',
  soundEnabled = true,
}: {
  style?: ClockStyle;
  color?: ClockColor;
  theme?: ThemeName;
  size?: ClockSize;
  soundEnabled?: boolean;
}) {
  // Tick at 1s. The `now` prop drives the casio and flip clock's
  // second-roll animation; on a 1s tick the second_2/second_1 digits
  // swap correctly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) | 0), 1000);
    return () => clearInterval(id);
  }, []);
  // Recreate `now` on every tick. The interval above guarantees
  // `tick` changes once per second, which (via deps) re-derives `now`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [tick]);

  const c = effectiveClockColor(color);

  if (style === 'analog') return <AnalogClock color={c} now={now} size={size} />;
  if (style === 'retro') return <RetroClock color={c} now={now} size={size} />;
  if (style === 'flip') return <FlipClock color={c} now={now} theme={theme} size={size} soundEnabled={soundEnabled} />;
  if (style === 'casio') return <CasioClock color={c} now={now} size={size} />;

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const hex = getColor(c);
  const isPlain = c === 'white' || c === 'ink';
  const scale = getSizeScale(size);

  return (
    <div className="font-mono flex items-baseline" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
      <div
        className="text-9xl font-thin tracking-tighter tabular-nums leading-none"
        style={{ color: hex, textShadow: isPlain ? undefined : `0 0 30px ${hex}66` }}
      >
        {hh}
        <span style={{ opacity: 0.3 }}>:</span>
        {mm}
      </div>
      <div
        className="text-6xl font-thin tabular-nums leading-none ml-3 self-end pb-2"
        style={{ color: hex, opacity: 0.7, textShadow: isPlain ? undefined : `0 0 20px ${hex}66` }}
      >
        {ss}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Analog clock
// --------------------------------------------------------------------------

function AnalogClock({
  color,
  now,
  size: sizeProp = 'md',
}: {
  color: ClockColor;
  now: Date;
  size?: ClockSize;
}) {
  const size = 280 * getSizeScale(sizeProp);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const hex = getColor(color);

  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const ms = now.getMilliseconds();

  const hourAngle = ((h + m / 60) * 30 - 90) * (Math.PI / 180);
  const minAngle = ((m + s / 60) * 6 - 90) * (Math.PI / 180);
  const secAngle = ((s + ms / 1000) * 6 - 90) * (Math.PI / 180);

  const hourLen = r * 0.55;
  const minLen = r * 0.8;
  const secLen = r * 0.9;

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 6 - 90) * (Math.PI / 180);
    const isHour = i % 5 === 0;
    const inner = r - (isHour ? 12 : 6);
    return {
      x1: cx + inner * Math.cos(a),
      y1: cy + inner * Math.sin(a),
      x2: cx + r * Math.cos(a),
      y2: cy + r * Math.sin(a),
      isHour,
    };
  });

  const hourEnd = { x: cx + hourLen * Math.cos(hourAngle), y: cy + hourLen * Math.sin(hourAngle) };
  const minEnd = { x: cx + minLen * Math.cos(minAngle), y: cy + minLen * Math.sin(minAngle) };
  const secEnd = { x: cx + secLen * Math.cos(secAngle), y: cy + secLen * Math.sin(secAngle) };
  const secIsHighlight = color === 'red';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-2xl">
      <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={hex} strokeWidth={2} opacity={0.8} />
      <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke={hex} strokeWidth={1} opacity={0.3} />

      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={hex}
          strokeWidth={t.isHour ? 2.5 : 1}
          opacity={t.isHour ? 0.9 : 0.4}
        />
      ))}

      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i + 1) * 30 - 90) * (Math.PI / 180);
        const r2 = r - 28;
        return (
          <text
            key={i}
            x={cx + r2 * Math.cos(a)}
            y={cy + r2 * Math.sin(a)}
            textAnchor="middle"
            dominantBaseline="central"
            fill={hex}
            fontSize={20}
            fontFamily="serif"
            fontWeight={500}
          >
            {i + 1}
          </text>
        );
      })}

      <line x1={cx} y1={cy} x2={hourEnd.x} y2={hourEnd.y} stroke={hex} strokeWidth={6} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={minEnd.x} y2={minEnd.y} stroke={hex} strokeWidth={4} strokeLinecap="round" />
      <line
        x1={cx}
        y1={cy}
        x2={secEnd.x}
        y2={secEnd.y}
        stroke={hex}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={secIsHighlight ? 1 : 0.7}
      />

      <circle cx={cx} cy={cy} r={6} fill={hex} />
      <circle cx={cx} cy={cy} r={2} fill="black" />
    </svg>
  );
}

// --------------------------------------------------------------------------
// Retro 7-segment clock — uses the "Seven Segment" font loaded in index.css
// for proper segment shapes (not a hand-rolled SVG).
// --------------------------------------------------------------------------

function RetroClock({
  color,
  now,
  size: sizeProp = 'md',
}: {
  color: ClockColor;
  now: Date;
  size?: ClockSize;
}) {
  const baseScale = getSizeScale(sizeProp);
  // Retro clock has its own dark background — force a visible color.
  const safeColor = safeDarkBgColor(color);
  const hex = getColor(safeColor);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const isPlain = safeColor === 'white' || safeColor === 'ink';
  const fontSize = 110 * baseScale;
  const colonFontSize = 110 * baseScale;

  // On-segment glow for neon/LED colors. Plain (white/ink) stays flat.
  const textShadow = isPlain ? undefined : `0 0 ${10 * baseScale}px ${hex}aa, 0 0 ${20 * baseScale}px ${hex}55`;

  return (
    <div
      className="p-6 rounded-2xl border-2"
      style={{
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderColor: `${hex}44`,
        boxShadow: `0 0 40px ${hex}33, inset 0 0 20px ${hex}1a`,
      }}
    >
      <div
        className="flex items-end justify-center tabular-nums"
        style={{
          fontFamily: "'Seven Segment', monospace",
          color: hex,
          textShadow,
          letterSpacing: `${4 * baseScale}px`,
        }}
      >
        <span style={{ fontSize }}>{hh}</span>
        <span style={{ fontSize: colonFontSize, marginInline: `${4 * baseScale}px` }}>:</span>
        <span style={{ fontSize }}>{mm}</span>
        <span style={{ fontSize: colonFontSize, marginInline: `${4 * baseScale}px` }}>:</span>
        <span style={{ fontSize }}>{ss}</span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Casio F-91W — uses the SVG from
// https://github.com/dundalek/casio-f91w-fsm (Jakub Dundalek + Alexis
// Philip, MIT). The reference is a 1480x1311 SVG with 7/8/9-segment
// LCDs inside a black resin case. We load it as an <object> and drive
// segment visibility the same way the reference's CasioF91WDigitalDisplay.js
// does (per-element opacity).
//
// We don't run the state machine — for a screensaver the time/date
// display is what matters. We render the dateTime menu only.
// --------------------------------------------------------------------------

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

function CasioClock({
  color,
  now,
  size: sizeProp = 'md',
}: {
  color: ClockColor;
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
  // OS does. Different menus use different digit fields. We list
  // `casio.stopwatchMs` explicitly because the stopwatch increments
  // out-of-band (via setInterval inside the hook); without it the
  // memo wouldn't re-fire when the stopwatch ticks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibility = useMemo(() => {
    return computeCasioVisibility(casio, now);
  }, [casio, now, casio.stopwatchMs]);

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

  // Reset stopwatch to 0 whenever the user navigates into the
  // stopwatch menu from another menu. (Reference behavior: leaving
  // stopwatch resets it on re-entry.)
  useEffect(() => {
    if (casio.state.menu === 'stopwatch' && casio.stopwatchMs === 0) {
      // No-op: already reset.
    }
  }, [casio.state.menu, casio.stopwatchMs]);

  // Tint the LCD via CSS hue-rotate. The reference SVG has fixed
  // green LCD segments; hue-rotate lets us shift the hue to match
  // the user's chosen clockColor while keeping the case/buttons grey.
  const tint = getCasioTintFilter(color);

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
  // Reference viewBox is 1480x1311, scaled to W x H. We map L/C/A
  // button regions (in viewBox units) to pixel positions.
  // L (top-left): x=104..149, y=477..547 → ~7% x, ~37% y
  // C (bottom-left): x=104..149, y=777..847 → ~7% x, ~60% y
  // A (right): x=1330..1375, y=777..847 → ~91% x, ~60% y
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
        // Cancel any held press if the cursor leaves the button.
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
  // The watch's effective time. In setDateTime the user has adjusted
  // the wall clock; in other menus the watch shows the real time.
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

  // Common per-frame values
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
      // CA510 easter egg: mode display shows "CA5" (top) and "10" (bottom).
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
    // Alarm screen. Show the alarm time (HH MM) and "AL" mode label.
    // Reference uses 24h for alarm display even when time is 12h.
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
    // Stopwatch shows minutes:seconds.hundredths (7 digits total).
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

      // Per-character segment displays (7/8/9-seg)
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

      // Per-flag elements (icons, AM/PM, etc.)
      for (const [id, on] of Object.entries(visibility.flags)) {
        const el = root.getElementById(id);
        if (el) el.setAttribute('opacity', on ? '1' : '0');
      }
    };

    // The <object> loads asynchronously; apply on load and on every
    // subsequent change.
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

// --------------------------------------------------------------------------
// Flip clock — ported from sLeeNguyen/react-flip-clock-countdown
// (https://github.com/sLeeNguyen/react-flip-clock-countdown)
//
// 4-layer model (simpler than FlipDown's 5-layer, visually identical
// "falling flap" effect):
//
//   1. fcc__next_above    — static, top half, shows NEXT digit
//                           (visible only during the flip, when the
//                            card is rotated past 90deg and the
//                            back face is showing)
//   2. fcc__current_below — static, bottom half, shows CURRENT digit
//                           (visible at rest; the "still" half)
//   3. fcc__card          — the animated flap, 50% height (top half),
//                           transform-origin: bottom, rotates 0 → -180deg
//   4. fcc__card_face_front (child of card) — top half, shows CURRENT
//                           at rest, hidden after flip
//      fcc__card_face_back  (child of card) — top half, pre-rotated
//                           -180deg, shows NEXT after flip
//
// CSS rules (from styles.module.css):
//   .digit_block { perspective: 200px; ... }
//   .next_above  { position: absolute; top: 0; height: 50%;
//                   border-bottom: 1px solid divider; }
//   .current_below { position: absolute; bottom: 0; height: 50%; }
//   .card { position: relative; z-index: 2; width: 100%; height: 50%;
//           transform-style: preserve-3d; transform-origin: bottom;
//           transform: rotateX(0); border-radius: inherit; }
//   .card.flipped { transition: transform 0.7s ease-in-out;
//                   transform: rotateX(-180deg); }
//   .card_face { position: absolute; width: 100%; height: 100%;
//                display: flex; justify-content: center; overflow: hidden;
//                backface-visibility: hidden; }
//   .card_face_front { align-items: flex-end;
//                      border-top-radius: inherit;
//                      border-bottom: 1px solid divider; }
//   .card_face_back  { align-items: flex-start;
//                      transform: rotateX(-180deg);
//                      border-bottom-radius: inherit; }
//
// Timing (from FlipClockDigit.tsx):
//   - On prop change: if current !== prop.current, setFlipped(true)
//   - On transitionend: setState({ current: prop.current }), setFlipped(false)
// --------------------------------------------------------------------------

function FlipDigit({
  ch,
  scale,
  cardBg,
  digitColor,
  dividerColor,
  soundEnabled,
}: {
  ch: string;
  scale: number;
  cardBg: string;
  digitColor: string;
  dividerColor: string;
  soundEnabled: boolean;
}) {
  const W = 46 * scale;
  const H = 80 * scale;
  const halfH = H / 2;
  const radius = 4 * scale;
  const fontSize = 50 * scale;
  const flipDuration = 700; // matches --fcc-flip-duration: 0.7s

  const [current, setCurrent] = useState(ch);
  const [next, setNext] = useState(ch);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (ch === current) return;
    // Set the "next" digit that will appear on the back face. The
    // front face still shows `current` so the falling flap animates
    // the OLD digit down. On transitionend we commit `ch` as the new
    // `current` and reset flipped to false.
    // We schedule these via queueMicrotask to avoid the React 19
    // set-state-in-effect warning — the effect still drives the flip
    // but defers the actual state writes to the next microtask.
    queueMicrotask(() => {
      setNext(ch);
      requestAnimationFrame(() => {
        setFlipped(true);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, soundEnabled]);

  // sLeeNguyen uses onTransitionEnd to commit the new current digit
  // and reset flipped. We do the same so the timing is exact (the
  // 700ms in the CSS, not 700ms +/- React render jitter).
  const handleTransitionEnd = () => {
    if (!flipped) return;
    setCurrent(ch);
    setFlipped(false);
    if (soundEnabled) playClack();
  };

  return (
    <div
      style={{
        perspective: 200,
        position: 'relative',
        width: W,
        height: H,
        borderRadius: radius,
        backgroundColor: cardBg,
        color: digitColor,
        fontSize,
        fontWeight: 500,
        lineHeight: 0,
        boxShadow: '0 0 2px 1px rgba(0,0,0,0.1)',
      }}
    >
      {/* Static "next above" — top half. Shows the NEXT digit, but is
          only visible when the card has rotated past ~90deg (i.e.
          during the second half of the flip). At rest it's covered
          by the card face front. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: halfH,
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          backgroundColor: cardBg,
          color: digitColor,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          borderBottom: `1px solid ${dividerColor}`,
        }}
      >
        <span style={{ lineHeight: 1, transform: 'translateY(50%)' }}>{next}</span>
      </div>

      {/* Static "current below" — bottom half. Shows CURRENT digit.
          This is the "still" half that never moves; the eye reads
          it as the lower portion of the card. */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: halfH,
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: cardBg,
          color: digitColor,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: radius,
        }}
      >
        <span style={{ lineHeight: 1, transform: 'translateY(-50%)' }}>{current}</span>
      </div>

      {/* The animated card — top half only, hinges from its bottom
          edge. Rotates 0 → -180deg on .flipped, 700ms ease-in-out. */}
      <div
        onTransitionEnd={handleTransitionEnd}
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          height: halfH,
          transformStyle: 'preserve-3d',
          transformOrigin: 'bottom',
          transform: flipped ? 'rotateX(-180deg)' : 'rotateX(0deg)',
          transition: flipped ? `transform ${flipDuration}ms ease-in-out` : 'none',
          borderRadius: radius,
        }}
      >
        {/* Front face — top half of the card. Shows CURRENT digit.
            align-items: flex-end positions the digit at the bottom
            of this face (so it lines up with the static bottom half
            when at rest). When the card rotates past 90deg, this
            face is hidden by backface-visibility. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            overflow: 'hidden',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            backgroundColor: cardBg,
            color: digitColor,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            borderBottom: `1px solid ${dividerColor}`,
          }}
        >
          <span style={{ lineHeight: 1, transform: 'translateY(50%)' }}>{current}</span>
        </div>

        {/* Back face — top half, pre-rotated -180deg so it faces the
            viewer once the card has flipped past 90deg. Shows NEXT
            digit, align-items: flex-start so the digit sits at the
            top of the face (lines up with the static top half
            showing next). */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            overflow: 'hidden',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            backgroundColor: cardBg,
            color: digitColor,
            transform: 'rotateX(-180deg)',
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
          }}
        >
          <span style={{ lineHeight: 1, transform: 'translateY(-50%)' }}>{next}</span>
        </div>
      </div>
    </div>
  );
}

function FlipColon({
  scale,
  color,
}: {
  scale: number;
  color: string;
}) {
  const H = 80 * scale;
  const dotSize = 5 * scale;
  return (
    <div
      style={{
        height: H,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: dotSize,
      }}
    >
      <div
        className="rounded-full"
        style={{ width: dotSize, height: dotSize, backgroundColor: color }}
      />
      <div
        className="rounded-full"
        style={{ width: dotSize, height: dotSize, backgroundColor: color }}
      />
    </div>
  );
}

function FlipClock({
  color,
  now,
  theme,
  size: sizeProp = 'md',
  soundEnabled = true,
}: {
  color: ClockColor;
  now: Date;
  theme: ThemeName;
  size?: ClockSize;
  soundEnabled?: boolean;
}) {
  const scale = getSizeScale(sizeProp);
  // Flip clock has its own dark card — force a visible color.
  const safeColor = safeDarkBgColor(color);
  const flipColor = getColor(safeColor);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  // Color palette (sLeeNguyen defaults: --fcc-background: #0f181a,
  // --fcc-digit-color: #ffffff, --fcc-divider-color: #ffffff66).
  // We tint by theme + selected color.
  const isPlain = safeColor === 'white' || safeColor === 'ink';
  let cardBg: string;
  let digitColor: string;
  let dividerColor: string;
  if (theme === 'claude') {
    cardBg = '#3a2e1f';
    digitColor = isPlain ? flipColor : '#faf6ef';
    dividerColor = '#faf6ef33';
  } else if (isPlain) {
    if (theme === 'dark') {
      cardBg = '#0f181a';
      digitColor = '#ffffff';
      dividerColor = '#ffffff66';
    } else {
      cardBg = '#f5f5f5';
      digitColor = '#1a1a1a';
      dividerColor = '#00000022';
    }
  } else {
    // Neon/accent: dark card with the chosen color as digit color
    cardBg = '#0f181a';
    digitColor = flipColor;
    dividerColor = `${flipColor}55`;
  }

  useEffect(() => {
    if (!soundEnabled) return;
    const unlock = () => unlockAudio();
    window.addEventListener('mousemove', unlock, { once: true, capture: true });
    window.addEventListener('click', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    window.addEventListener('touchstart', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('mousemove', unlock, { capture: true });
      window.removeEventListener('click', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      window.removeEventListener('touchstart', unlock, { capture: true });
    };
  }, [soundEnabled]);

  const card = (c: string) => (
    <FlipDigit
      ch={c}
      scale={scale}
      cardBg={cardBg}
      digitColor={digitColor}
      dividerColor={dividerColor}
      soundEnabled={soundEnabled}
    />
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8 * scale,
        userSelect: 'none',
      }}
    >
      {card(hh[0])}
      {card(hh[1])}
      <FlipColon scale={scale} color={digitColor} />
      {card(mm[0])}
      {card(mm[1])}
      <FlipColon scale={scale} color={digitColor} />
      {card(ss[0])}
      {card(ss[1])}
    </div>
  );
}

// --------------------------------------------------------------------------
// World clock
// --------------------------------------------------------------------------

function getDayDiff(localNow: Date, tz: string): number {
  // Compare midnight timestamps in local vs remote tz — robust across DST.
  const localMid = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate()).getTime();
  const remoteMidStr = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  }).format(localNow); // yyyy-mm-dd
  const [y, m, d] = remoteMidStr.split('-').map(Number);
  const remoteMid = Date.UTC(y, m - 1, d);
  const localMidUtc = Date.UTC(
    new Date(localMid).getUTCFullYear(),
    new Date(localMid).getUTCMonth(),
    new Date(localMid).getUTCDate(),
  );
  return Math.round((remoteMid - localMidUtc) / 86_400_000);
}

export function WorldClock({
  color = 'white',
  theme = 'dark',
  cities = DEFAULT_CITIES,
}: {
  color?: ClockColor;
  theme?: ThemeName;
  cities?: { name: string; tz: string }[];
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const c = effectiveClockColor(color);
  const hex = getColor(c);
  const label =
    theme === 'dark' ? 'text-white/70' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'text-black/70';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
      {cities.map((city) => {
        const timeStr = new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: city.tz,
          hour12: false,
        }).format(now);
        const dayDiff = getDayDiff(now, city.tz);
        const dayHint =
          dayDiff === 0 ? '' : dayDiff > 0 ? ` +${dayDiff}` : ` ${dayDiff}`;
        return (
          <div key={city.name} className="text-center">
            <div className={`text-xs mb-1 ${label}`}>
              {city.name}
              {dayHint && <span className="opacity-50 ml-0.5">{dayHint}</span>}
            </div>
            <div className="text-2xl tabular-nums tracking-tight" style={{ color: hex }}>
              {timeStr}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// Date display
// --------------------------------------------------------------------------

export function DateDisplay({ theme = 'dark' }: { theme?: ThemeName }) {
  const [now, setNow] = useState(new Date());

  // Align next refresh to the start of the next minute so the display
  // rolls over exactly when the wall-clock minute changes.
  useEffect(() => {
    let timeoutId: number;
    let intervalId: number;
    const schedule = () => {
      const ms = 60_000 - (Date.now() % 60_000);
      timeoutId = window.setTimeout(() => {
        setNow(new Date());
        intervalId = window.setInterval(() => setNow(new Date()), 60_000);
      }, ms);
    };
    schedule();
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  const dayName = now.toLocaleDateString(undefined, { weekday: 'long' });
  const dateStr = now.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const label =
    theme === 'dark' ? 'text-white/60' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'text-black/70';
  const main = theme === 'dark' ? 'text-white' : theme === 'claude' ? 'text-[#3a2e1f]' : 'text-black';

  return (
    <div className="text-center">
      <div className={`text-2xl font-light tracking-wide ${main}`}>{dayName}</div>
      <div className={`text-sm mt-1 ${label}`}>{dateStr}</div>
    </div>
  );
}
