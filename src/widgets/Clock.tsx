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
// Casio F-91W-style LCD clock
// Black resin case, faint green LCD (positive display, not negative).
// Module 593 layout: weekday + date on top, big time digits in the
// middle, AM/PM + seconds + mode label at the bottom. We render the
// mode label as "WATER RESIST" (the front-of-case marking) to give
// the iconic feel.
//
// Reference: https://en.wikipedia.org/wiki/Casio_F-91W
//   "faint green LED" backlight, top row day+date, center time,
//   bottom row PM/24H + seconds, alarm "bar of vertical lines" indicator.
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
  // Real F-91W is ~37mm wide. We use 240x96 viewbox at scale=1, which
  // matches the aspect ratio of the real face (~37:15 mm).
  const W = 240 * scale;
  const H = 96 * scale;
  const radius = 6 * scale;
  const padding = 6 * scale;
  // LCD area inside the case
  const lcdInset = 8 * scale;
  const lcdW = W - lcdInset * 2;
  const lcdH = H - lcdInset * 2;

  // Time strings
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const isPM = now.getHours() >= 12;

  // Date strings
  const dayShort = now.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const dateNum = String(now.getDate()).padStart(2, '0');

  // LCD colors: faint green-cyan positive display on dark background.
  // We use a teal-grey digit color on a tinted black LCD panel.
  // The actual digit/label colors come from `tint` below, which is
  // driven by the user's chosen clock color.
  // Allow the user to tint the LCD color (via the clockColor picker).
  // 'ink' / 'white' / 'cyan' / etc. map to a green-tinted analog.
  const tint = useCasioTint(color);

  return (
    <div
      style={{
        width: W,
        height: H,
        background: `linear-gradient(180deg, #1a1a1a 0%, ${caseBg} 50%, #050505 100%)`,
        borderRadius: radius,
        position: 'relative',
        boxShadow: `0 ${4 * scale}px ${12 * scale}px rgba(0,0,0,0.6), inset 0 ${1 * scale}px 0 rgba(255,255,255,0.08), inset 0 -${1 * scale}px 0 rgba(0,0,0,0.5)`,
        padding,
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      {/* "CASIO" branding on the case (top-left of LCD area) */}
      <div
        style={{
          position: 'absolute',
          top: padding + 2 * scale,
          left: padding + 4 * scale,
          fontSize: 7 * scale,
          fontWeight: 800,
          letterSpacing: `${1 * scale}px`,
          color: '#9a9a9a',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        CASIO
      </div>
      <div
        style={{
          position: 'absolute',
          top: padding + 2 * scale,
          right: padding + 4 * scale,
          fontSize: 5 * scale,
          color: '#6a6a6a',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        WATER RESIST
      </div>

      {/* LCD panel */}
      <div
        style={{
          position: 'relative',
          width: lcdW,
          height: lcdH,
          margin: `${10 * scale}px 0 0 0`,
          background: lcdBg,
          borderRadius: 2 * scale,
          boxShadow: `inset 0 0 ${4 * scale}px rgba(0,0,0,0.8), inset 0 0 ${10 * scale}px ${lcdGlow}`,
          overflow: 'hidden',
          // Faint pixel grid texture to evoke the LCD dot matrix
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0, transparent ${2 * scale}px, rgba(120, 200, 130, 0.02) ${2 * scale}px, rgba(120, 200, 130, 0.02) ${3 * scale}px)`,
        }}
      >
        {/* Top row: weekday + date */}
        <div
          style={{
            position: 'absolute',
            top: 2 * scale,
            left: 4 * scale,
            right: 4 * scale,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 7 * scale,
            lineHeight: 1,
            color: tint.label,
            fontWeight: 600,
            letterSpacing: `${0.5 * scale}px`,
          }}
        >
          <span>{dayShort}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{dateNum}</span>
        </div>

        {/* Center: large time HH:MM */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 2 * scale,
          }}
        >
          <span
            style={{
              fontSize: 32 * scale,
              lineHeight: 1,
              color: tint.digit,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              textShadow: `0 0 ${4 * scale}px ${tint.glow}`,
              letterSpacing: `${1 * scale}px`,
            }}
          >
            {hh}
            <span style={{ opacity: 0.4 }}>:</span>
            {mm}
          </span>
        </div>

        {/* Bottom row: AM/PM + seconds + alarm/chime indicators */}
        <div
          style={{
            position: 'absolute',
            bottom: 2 * scale,
            left: 4 * scale,
            right: 4 * scale,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 7 * scale,
            lineHeight: 1,
            color: tint.label,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {/* AM/PM indicator — typical LCD shows the active one, dims the other */}
          <span style={{ display: 'flex', gap: 4 * scale }}>
            <span
              style={{
                opacity: isPM ? 0.35 : 1,
                color: isPM ? tint.label : tint.digit,
                textShadow: isPM ? 'none' : `0 0 ${3 * scale}px ${tint.glow}`,
              }}
            >
              AM
            </span>
            <span
              style={{
                opacity: isPM ? 1 : 0.35,
                color: isPM ? tint.digit : tint.label,
                textShadow: isPM ? `0 0 ${3 * scale}px ${tint.glow}` : 'none',
              }}
            >
              PM
            </span>
          </span>

          {/* Seconds */}
          <span style={{ color: tint.digit, textShadow: `0 0 ${3 * scale}px ${tint.glow}` }}>
            {ss}
          </span>

          {/* Alarm/chime indicators — small dots/bars for alarm (vertical lines)
              and bell for hourly chime. Show them active to feel "armed". */}
          <span style={{ display: 'flex', gap: 3 * scale, alignItems: 'center' }}>
            {/* Alarm: bar of vertical lines (4 short lines) */}
            <span
              style={{
                display: 'inline-flex',
                gap: 0.5 * scale,
                color: tint.digit,
                textShadow: `0 0 ${2 * scale}px ${tint.glow}`,
              }}
              aria-label="Alarm on"
            >
              <span style={{ borderLeft: `1px solid currentColor`, width: 1, height: 6 * scale }} />
              <span style={{ borderLeft: `1px solid currentColor`, width: 1, height: 6 * scale }} />
              <span style={{ borderLeft: `1px solid currentColor`, width: 1, height: 6 * scale }} />
              <span style={{ borderLeft: `1px solid currentColor`, width: 1, height: 6 * scale }} />
            </span>
            {/* Hourly chime: bell shape (use 🔔-like glyph) */}
            <span
              style={{ color: tint.digit, textShadow: `0 0 ${2 * scale}px ${tint.glow}` }}
              aria-label="Hourly chime on"
            >
              ♪
            </span>
          </span>
        </div>
      </div>
    </div>
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
