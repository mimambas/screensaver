import { useEffect, useState } from 'react';
import {
  DEFAULT_CITIES,
  effectiveClockColor,
  getColor,
  getSizeScale,
  safeDarkBgColor,
} from './clock-constants';
import { playClack, unlockAudio } from './audio';
import type { ClockColor, ClockSize, ClockStyle, ThemeName } from './clock-constants';

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
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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
// Casio F-91W — ported from https://github.com/dundalek/casio-f91w-fsm
// (interactive F-91W model by Jakub Dundalek + Alexis Philip, licensed MIT)
//
// The reference is a statechart-driven full F-91W emulation: 4 menus
// (dateTime, dailyAlarm, stopwatch, setDateTime), 3 buttons (L C A),
// real Module 593 behaviour including the CA510 easter egg (hold A
// for 3s on the time screen).
//
// We render the same display: a 7-/8-/9-segment LCD inside a black
// resin case, using the same charToSegments segment table from
// `CasioF91WDigitalDisplay.js` (digits 0-9 + A C E F H I L O S U +
// " " for blank). EuroStyle font (the real Casio face font) for the
// case branding, monospace for the LCD text.
//
// We don't emulate the buttons or state machine — for a screensaver
// the time/date display is what matters. But the layout, segment
// shapes, and case details match the reference faithfully.
// --------------------------------------------------------------------------

function CasioClock({
  color,
  now,
  size: sizeProp = 'md',
}: {
  color: ClockColor;
  now: Date;
  size?: ClockSize;
}) {
  const scale = getSizeScale(sizeProp);
  // The reference SVG is 1480x1311. Aspect ratio ≈ 1.13. We use 360x320
  // viewbox at scale=1, which keeps the proportions and gives a
  // comfortable size on screen.
  const W = 360 * scale;
  const H = 320 * scale;
  const caseRadius = 18 * scale;
  const bezelInset = 18 * scale;
  const innerRadius = 6 * scale;

  // Time and date components, matching the reference's display mapping
  // for the default dateTime menu.
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const isPM = hours >= 12;
  // Reference shows 12-hour mode by default, with PM indicator.
  // We follow that: if hour > 12, subtract 12. (24h mode would show
  // hours as-is; toggleable in the real watch via holding C on time.)
  const displayHours = hours > 12 ? hours - 12 : hours;
  const hh1 = displayHours >= 10 ? Math.floor(displayHours / 10).toString() : ' ';
  const hh2 = (displayHours % 10).toString();
  const mm1 = minutes >= 10 ? Math.floor(minutes / 10).toString() : '0';
  const mm2 = (minutes % 10).toString();
  const ss1 = Math.floor(seconds / 10).toString();
  const ss2 = (seconds % 10).toString();
  const dayLetters = now.toLocaleDateString('en-US', { weekday: 'long' }).slice(0, 2).toUpperCase();
  const dayNum = now.getDate();
  const day1 = dayNum >= 10 ? Math.floor(dayNum / 10).toString() : ' ';
  const day2 = (dayNum % 10).toString();

  // LCD colors
  const caseBg = '#0a0a0a';
  const lcdBg = '#1a1f1c';
  const tint = useCasioTint(color);

  // Segment display parameters
  const segW = 22 * scale;
  const segH = 38 * scale;
  const segT = 4 * scale; // segment thickness
  const segGap = 2 * scale;
  const segColor = tint.digit;
  const segOff = 'transparent';

  return (
    <div
      style={{
        width: W,
        height: H,
        background: `linear-gradient(165deg, #2a2a2a 0%, ${caseBg} 35%, #050505 100%)`,
        borderRadius: caseRadius,
        position: 'relative',
        boxShadow: `0 ${6 * scale}px ${20 * scale}px rgba(0,0,0,0.7), inset 0 ${1 * scale}px 0 rgba(255,255,255,0.1), inset 0 -${2 * scale}px ${4 * scale}px rgba(0,0,0,0.6)`,
        fontFamily: 'EuroStyle, Calibri, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {/* "CASIO" branding — top-left of case, like the real watch */}
      <div
        style={{
          position: 'absolute',
          top: 8 * scale,
          left: 14 * scale,
          fontSize: 13 * scale,
          fontWeight: 700,
          letterSpacing: `${1.5 * scale}px`,
          color: '#a0a0a0',
        }}
      >
        CASIO
      </div>
      {/* "WATER RESIST" — top-right */}
      <div
        style={{
          position: 'absolute',
          top: 11 * scale,
          right: 14 * scale,
          fontSize: 7 * scale,
          letterSpacing: `${0.5 * scale}px`,
          color: '#707070',
        }}
      >
        WATER RESIST
      </div>
      {/* Module label — bottom-right of case */}
      <div
        style={{
          position: 'absolute',
          bottom: 9 * scale,
          right: 14 * scale,
          fontSize: 6 * scale,
          letterSpacing: `${0.5 * scale}px`,
          color: '#555555',
        }}
      >
        MOD 593
      </div>

      {/* LCD bezel — the recessed black ring around the LCD */}
      <div
        style={{
          position: 'absolute',
          top: bezelInset,
          left: bezelInset,
          right: bezelInset,
          bottom: bezelInset,
          background: 'linear-gradient(180deg, #050505 0%, #1a1a1a 50%, #050505 100%)',
          borderRadius: innerRadius,
          padding: 4 * scale,
          boxShadow: `inset 0 ${2 * scale}px ${4 * scale}px rgba(0,0,0,0.9), inset 0 -${1 * scale}px ${2 * scale}px rgba(255,255,255,0.05)`,
        }}
      >
        {/* LCD panel itself */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: lcdBg,
            borderRadius: 2 * scale,
            overflow: 'hidden',
            // Faint pixel grid texture (LCD dot matrix)
            backgroundImage: `repeating-linear-gradient(0deg, transparent 0, transparent ${2 * scale}px, rgba(150, 220, 160, 0.025) ${2 * scale}px, rgba(150, 220, 160, 0.025) ${3 * scale}px)`,
            boxShadow: `inset 0 0 ${6 * scale}px rgba(0,0,0,0.6)`,
          }}
        >
          {/* --- Top-left: mode indicator (2x 7/8/9-seg displays) --- */}
          <div
            style={{
              position: 'absolute',
              top: 8 * scale,
              left: 8 * scale,
              display: 'flex',
              gap: 2 * scale,
            }}
          >
            <SegmentDisplay char={dayLetters[0]} segments={9} w={segW * 0.85} h={segH * 0.7} t={segT * 0.8} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
            <SegmentDisplay char={dayLetters[1]} segments={8} w={segW * 0.85} h={segH * 0.7} t={segT * 0.8} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
          </div>

          {/* --- Top-right: day-of-month (2x 7-seg) + alarm + signal icons --- */}
          <div
            style={{
              position: 'absolute',
              top: 12 * scale,
              right: 8 * scale,
              display: 'flex',
              alignItems: 'center',
              gap: 4 * scale,
            }}
          >
            {/* Day-of-month digits */}
            <div style={{ display: 'flex', gap: 2 * scale }}>
              <SegmentDisplay char={day1} segments={7} w={segW * 0.7} h={segH * 0.6} t={segT * 0.7} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
              <SegmentDisplay char={day2} segments={7} w={segW * 0.7} h={segH * 0.6} t={segT * 0.7} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
            </div>
            {/* Alarm + signal icons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 * scale, marginLeft: 4 * scale }}>
              <AlarmBellIcon color={segColor} glow={tint.glow} scale={scale} />
              <SignalIcon color={segColor} glow={tint.glow} scale={scale} />
            </div>
          </div>

          {/* --- Middle: colon dots (left) + time digits (right) --- */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 14 * scale,
              right: 14 * scale,
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4 * scale,
            }}
          >
            {/* Hours (2 digits) */}
            <div style={{ display: 'flex', gap: 3 * scale }}>
              <SegmentDisplay char={hh1} segments={7} w={segW} h={segH} t={segT} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
              <SegmentDisplay char={hh2} segments={7} w={segW} h={segH} t={segT} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
            </div>
            {/* Colon dots (between hours and minutes) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 * scale, marginInline: 2 * scale }}>
              <span style={{ width: 4 * scale, height: 4 * scale, borderRadius: '50%', background: segColor, boxShadow: `0 0 ${3 * scale}px ${tint.glow}` }} />
              <span style={{ width: 4 * scale, height: 4 * scale, borderRadius: '50%', background: segColor, boxShadow: `0 0 ${3 * scale}px ${tint.glow}` }} />
            </div>
            {/* Minutes (2 digits) */}
            <div style={{ display: 'flex', gap: 3 * scale }}>
              <SegmentDisplay char={mm1} segments={7} w={segW} h={segH} t={segT} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
              <SegmentDisplay char={mm2} segments={7} w={segW} h={segH} t={segT} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
            </div>
          </div>

          {/* --- Bottom: seconds (right) + AM/PM (left) --- */}
          <div
            style={{
              position: 'absolute',
              bottom: 10 * scale,
              left: 14 * scale,
              right: 14 * scale,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* AM/PM (left) */}
            <div style={{ display: 'flex', gap: 4 * scale, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 9 * scale,
                  fontWeight: 700,
                  color: isPM ? tint.label : tint.digit,
                  opacity: isPM ? 0.35 : 1,
                  textShadow: isPM ? 'none' : `0 0 ${2 * scale}px ${tint.glow}`,
                  letterSpacing: `${0.5 * scale}px`,
                }}
              >
                AM
              </span>
              <span
                style={{
                  fontSize: 9 * scale,
                  fontWeight: 700,
                  color: isPM ? tint.digit : tint.label,
                  opacity: isPM ? 1 : 0.35,
                  textShadow: isPM ? `0 0 ${2 * scale}px ${tint.glow}` : 'none',
                  letterSpacing: `${0.5 * scale}px`,
                }}
              >
                PM
              </span>
            </div>
            {/* Seconds (right) */}
            <div style={{ display: 'flex', gap: 2 * scale }}>
              <SegmentDisplay char={ss1} segments={7} w={segW * 0.7} h={segH * 0.6} t={segT * 0.7} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
              <SegmentDisplay char={ss2} segments={7} w={segW * 0.7} h={segH * 0.6} t={segT * 0.7} gap={segGap} color={segColor} off={segOff} glow={tint.glow} scale={scale} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// SegmentDisplay — generic 7/8/9-segment LCD digit.
// Segments are labeled A-G (standard) plus H (top-right diagonal) and
// I (bottom-right diagonal) for 9-segment displays. The 7-seg segment
// table is from the reference (CasioF91WDigitalDisplay.js); 8/9-seg
// extra letters are merged in.
// --------------------------------------------------------------------------

type SegKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

// Segment ON-set per char, for 7-seg (the most common). 8/9-seg
// variants override the special letters below.
const SEVEN_SEG: Record<string, SegKey[]> = {
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
// 8-seg: adds H as top-right diagonal (used for letters that need a
// slanted right edge like R).
const EIGHT_SEG: Record<string, SegKey[]> = {
  ...SEVEN_SEG,
  T: ['A', 'E', 'F', 'H'],
  R: ['A', 'B', 'C', 'E', 'F', 'G', 'H'],
};
// 9-seg: adds I as bottom-right diagonal. Used for M, W.
const NINE_SEG: Record<string, SegKey[]> = {
  ...EIGHT_SEG,
  M: ['A', 'B', 'C', 'E', 'F', 'H', 'I'],
  W: ['B', 'C', 'D', 'E', 'F', 'H', 'I'],
};

function SegmentDisplay({
  char,
  segments,
  w,
  h,
  t,
  gap,
  color,
  off,
  glow,
  scale,
}: {
  char: string;
  segments: 7 | 8 | 9;
  w: number;
  h: number;
  t: number;
  gap: number;
  color: string;
  off: string;
  glow: string;
  scale: number;
}) {
  const table = segments === 9 ? NINE_SEG : segments === 8 ? EIGHT_SEG : SEVEN_SEG;
  const on = (table[char] ?? table[' '] ?? []) as SegKey[];
  const isOn = (k: SegKey) => on.includes(k);
  const fill = (k: SegKey) => (isOn(k) ? color : off);
  const filter = (k: SegKey) =>
    isOn(k) ? `drop-shadow(0 0 ${2 * scale}px ${glow})` : undefined;

  // Standard 7-seg layout (in viewBox units of w x h):
  //   AAAA
  //  F   B
  //  F   B
  //   GGGG
  //  E   C
  //  E   C
  //   DDDD
  // 8-seg adds H as a diagonal in the top-right corner (B and F area).
  // 9-seg adds I as a diagonal in the bottom-right corner (C and E area).
  //
  // Segment shapes are drawn as polygons so the chamfered ends of
  // each segment look like the real LCD pixels (small parallelogram).
  const g = gap;
  const halfH = h / 2;
  // Chamfer makes the segment ends look like 7-seg displays (slight
  // diagonal cut instead of a hard rectangle).
  const chamfer = t * 0.3;

  // Horizontal segment (A, D, G): a flattened hexagon spanning full width.
  const horizSeg = (y: number) => {
    return `${g + chamfer},${y} ${w - g - chamfer},${y} ${w - g - chamfer - t * 0.5},${y + t * 0.5} ${w - g - chamfer},${y + t} ${g + chamfer},${y + t} ${g + chamfer + t * 0.5},${y + t * 0.5}`;
  };

  // Vertical segment (B, C, E, F): a hexagon spanning half height.
  const vertSeg = (x: number) => {
    return `${x},${g + chamfer} ${x + t},${g + chamfer + t * 0.5} ${x + t},${halfH - chamfer - t * 0.5} ${x},${halfH - chamfer} ${x},${halfH - chamfer} ${x - t * 0},${halfH - chamfer}`;
  };

  // Diagonal segment (H, I): a thin parallelogram for the slanted edge.
  const diagSegTR = () => {
    // H sits in the top-right corner: spans from middle-right (B) to
    // top-right corner, slanting outward.
    return `${w - g - t},${g + chamfer * 2} ${w - g},${g + chamfer + t} ${w - g},${halfH - chamfer - t * 0.5} ${w - g - t},${halfH - chamfer - t} ${w - g - t * 1.6},${g + chamfer * 2 + t}`;
  };
  const diagSegBR = () => {
    // I sits in the bottom-right corner: from middle-right (C) to
    // bottom-right corner.
    return `${w - g},${halfH + chamfer + t * 0.5} ${w - g - t},${halfH + chamfer + t} ${w - g - t},${h - g - chamfer - t} ${w - g},${h - g - chamfer} ${w - g - t * 1.6},${h - g - chamfer - t * 1.5}`;
  };

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <g>
        {/* A — top horizontal */}
        <polygon points={horizSeg(g)} fill={fill('A')} style={{ filter: filter('A') }} />
        {/* B — top-right vertical */}
        <polygon points={vertSeg(w - g - t)} fill={fill('B')} style={{ filter: filter('B') }} />
        {/* C — bottom-right vertical */}
        <polygon
          points={`${w - g - t},${halfH + chamfer} ${w - g},${halfH + chamfer + t * 0.5} ${w - g},${h - g - chamfer} ${w - g - t},${h - g - chamfer - t * 0.5} ${w - g - t * 1.6},${halfH + chamfer + t}`}
          fill={fill('C')}
          style={{ filter: filter('C') }}
        />
        {/* D — bottom horizontal */}
        <polygon
          points={`${g + chamfer + t * 0.5},${h - g - t} ${w - g - chamfer - t * 0.5},${h - g - t} ${w - g - chamfer},${h - g} ${g + chamfer},${h - g} ${g + chamfer + t * 0.5},${h - g - t}`}
          fill={fill('D')}
          style={{ filter: filter('D') }}
        />
        {/* E — bottom-left vertical */}
        <polygon
          points={`${g},${halfH + chamfer} ${g + t},${halfH + chamfer + t * 0.5} ${g + t},${h - g - chamfer - t * 0.5} ${g},${h - g - chamfer} ${g + t * 0.5},${halfH + chamfer + t}`}
          fill={fill('E')}
          style={{ filter: filter('E') }}
        />
        {/* F — top-left vertical */}
        <polygon
          points={`${g + t},${g + chamfer + t * 0.5} ${g},${g + chamfer} ${g},${halfH - chamfer} ${g + t},${halfH - chamfer - t * 0.5} ${g + t * 1.6},${g + chamfer + t * 1.5}`}
          fill={fill('F')}
          style={{ filter: filter('F') }}
        />
        {/* G — middle horizontal */}
        <polygon
          points={`${g + chamfer + t * 0.5},${halfH - t / 2} ${w - g - chamfer - t * 0.5},${halfH - t / 2} ${w - g - chamfer},${halfH} ${w - g - chamfer - t * 0.5},${halfH + t / 2} ${g + chamfer + t * 0.5},${halfH + t / 2} ${g + chamfer},${halfH}`}
          fill={fill('G')}
          style={{ filter: filter('G') }}
        />
        {/* H — top-right diagonal (8/9-seg only) */}
        {segments >= 8 && (
          <polygon points={diagSegTR()} fill={fill('H')} style={{ filter: filter('H') }} />
        )}
        {/* I — bottom-right diagonal (9-seg only) */}
        {segments === 9 && (
          <polygon points={diagSegBR()} fill={fill('I')} style={{ filter: filter('I') }} />
        )}
      </g>
    </svg>
  );
}

// --------------------------------------------------------------------------
// Alarm bell icon — drawn as an SVG to match the LCD icon style of
// the real F-91W (small bell with a clapper).
// --------------------------------------------------------------------------

function AlarmBellIcon({ color, glow, scale }: { color: string; glow: string; scale: number }) {
  return (
    <svg width={10 * scale} height={12 * scale} viewBox="0 0 10 12" style={{ filter: `drop-shadow(0 0 ${1.5 * scale}px ${glow})` }}>
      {/* Bell body */}
      <path
        d="M5 1 C 3 1 2 2.5 2 5 L 2 8 L 1.2 9 L 8.8 9 L 8 8 L 8 5 C 8 2.5 7 1 5 1 Z"
        fill={color}
      />
      {/* Clapper */}
      <circle cx="5" cy="10.5" r="0.7" fill={color} />
      {/* Top knob */}
      <rect x="4.2" y="0" width="1.6" height="1" fill={color} />
    </svg>
  );
}

// --------------------------------------------------------------------------
// Signal/chime icon — five ascending bars (radio signal).
// --------------------------------------------------------------------------

function SignalIcon({ color, glow, scale }: { color: string; glow: string; scale: number }) {
  const barW = 1.6 * scale;
  const gap = 1 * scale;
  return (
    <svg width={12 * scale} height={10 * scale} viewBox="0 0 12 10" style={{ filter: `drop-shadow(0 0 ${1.5 * scale}px ${glow})` }}>
      {[2, 4, 6, 8, 10].map((h, i) => (
        <rect
          key={i}
          x={i * (barW + gap)}
          y={10 - h}
          width={barW}
          height={h}
          fill={color}
        />
      ))}
    </svg>
  );
}

// Tint the LCD digits/labels based on the user's chosen clock color.
// The default is the iconic F-91W green; neon picks map to a tinted
// version of that color (not full saturation, since real LCDs are
// muted).
function useCasioTint(color: ClockColor) {
  switch (color) {
    case 'white':
      return { digit: '#a8b0a0', label: '#5a6058', glow: 'rgba(180, 200, 170, 0.6)' };
    case 'ink':
      return { digit: '#3a4a3e', label: '#2a3a2e', glow: 'rgba(80, 100, 80, 0.3)' };
    case 'amber':
      return { digit: '#b88a3a', label: '#5a4520', glow: 'rgba(200, 150, 60, 0.6)' };
    case 'green':
      return { digit: '#6ac270', label: '#3a6040', glow: 'rgba(120, 220, 130, 0.7)' };
    case 'cyan':
      return { digit: '#5ab8b8', label: '#2a5050', glow: 'rgba(100, 200, 200, 0.6)' };
    case 'red':
      return { digit: '#b84a4a', label: '#5a2828', glow: 'rgba(200, 90, 90, 0.6)' };
    case 'pink':
      return { digit: '#b85a90', label: '#5a2840', glow: 'rgba(200, 120, 160, 0.6)' };
    default:
      return { digit: '#5f9c6a', label: '#3a5a42', glow: 'rgba(120, 200, 130, 0.6)' };
  }
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
