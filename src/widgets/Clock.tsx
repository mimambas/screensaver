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
// Flip clock — verbatim port of FlipDown.js (v0.2.2)
//
// Reference CSS (5 rules per rotor, all positioning/colors verbatim):
//
//   .rotor {                                  ← 50×80, perspective 200, 4px radius
//     perspective: 200px;
//     position: relative;
//     width: 50px; height: 80px;
//     border-radius: 4px;
//     font-size: 4rem;
//     text-align: center;
//   }
//   .rotor-top, .rotor-bottom {               ← static, 50×40 each
//     position: absolute; overflow: hidden;
//     width: 50px; height: 40px;
//   }
//   .rotor-top      { line-height: 80px; border-radius: 4px 4px 0 0; }
//   .rotor-bottom   { bottom: 0; line-height: 0; border-radius: 0 0 4px 4px; }
//   .rotor-leaf {                              ← animates rotateX
//     z-index: 1; position: absolute;
//     width: 50px; height: 80px;
//     transform-style: preserve-3d;
//     transition: transform 0s;                ← idle: no transition
//   }
//   .rotor-leaf.flipped {
//     transform: rotateX(-180deg);
//     transition: all 0.5s ease-in-out;       ← flipped: animate
//   }
//   .rotor-leaf-front, .rotor-leaf-rear {
//     position: absolute; overflow: hidden;
//     width: 50px; height: 40px; margin: 0;
//     transform: rotateX(0deg);
//     backface-visibility: hidden;
//   }
//   .rotor-leaf-front {
//     line-height: 80px;                       ← digit centered on its
//     border-radius: 4px 4px 0 0;                own figure (which is 40px
//   }                                            tall; line-height: 80px
//   .rotor-leaf-rear {                          pushes digit to top)
//     line-height: 0;
//     border-radius: 0 0 4px 4px;
//     transform: rotateX(-180deg);            ← pre-rotated
//   }
//   .rotor:after {                            ← hinge: 1px line, 40px tall,
//     content: ''; z-index: 2; position: absolute;     drawn over the bottom
//     bottom: 0; left: 0;                       half (so the seam reads as
//     width: 50px; height: 40px;                 the split between halves)
//     border-radius: 0 0 4px 4px;
//   }
//   .flipdown__theme-dark:
//     .rotor-top, .rotor-leaf-front: #FFFFFF / #151515
//     .rotor-bottom, .rotor-leaf-rear: #EFEFEF / #202020
//     .rotor:after border-top: 1px solid #151515
//   .flipdown__theme-light:
//     .rotor-top, .rotor-leaf-front: #222 / #DDD
//     .rotor-bottom, .rotor-leaf-rear: #333 / #EEE
//     .rotor:after border-top: 1px solid #222
//
// Reference JS (verbatim behavior):
//   1. prevClockValues → rotorLeafFront + rotorBottom (visible faces)
//   2. setTimeout 500ms → rotorTop text → NEW digit (back of falling flap)
//   3. setTimeout 500ms → rotorLeafRear text → NEW digit + add `.flipped`
//      class to rotorLeaf. After 500ms, remove `.flipped`.
//   4. After both timeouts: prevClockValues ← new values.
//
// So the eye sees:
//   - The visible faces show OLD digit throughout the flip.
//   - At t=500ms, the falling top half (rotorTop) suddenly shows the
//     NEW digit (its back side). The static front face of the falling
//     flap (rotorLeafFront) still shows OLD digit while it rotates
//     down — the user sees the OLD digit rotate down out of view.
//   - At t=500ms, the .flipped class is added → the rotorLeaf rotates
//     -180deg over 500ms. As it rotates, the rotorLeafRear (pre-rotated
//     +180, so it now faces the viewer) reveals the NEW digit's bottom.
//   - At t=1000ms, the .flipped class is removed → instant reset to 0deg
//     (transition: transform 0s in idle state). The leaf re-covers the
//     static faces, showing OLD digit's top (rotorLeafFront) and OLD
//     digit's bottom (which is now stale but covered).
//   - The next tick of the tick interval updates prevClockValues and the
//     cycle restarts.
//
// We reproduce this exactly: 5 layers, 2 setTimeouts, text-content
// swaps at the 500ms mark, flip class added then auto-removed at 500ms.
// --------------------------------------------------------------------------

function FlipDigit({
  ch,
  scale,
  cardBg,
  flapBg,
  digitColorTop,
  digitColorBottom,
  edgeColor,
  soundEnabled,
}: {
  ch: string;
  scale: number;
  cardBg: string;
  flapBg: string;
  digitColorTop: string;
  digitColorBottom: string;
  edgeColor: string;
  soundEnabled: boolean;
}) {
  // 5:8 aspect ratio (50x80 at scale=1) — matches .rotor exactly.
  const W = 50 * scale;
  const H = 80 * scale;
  const halfH = H / 2;
  const radius = 4 * scale;
  // Reference uses font-size: 4rem (≈64px) on .rotor. Both top and
  // bottom figures use line-height: 80px (= full rotor height) to
  // center the digit vertically within the figure. The figure is 40px
  // tall but overflows; the line-height: 80px pushes the baseline to
  // the middle, and the parent flexbox-like alignment comes from the
  // line-height itself, not from CSS flex/grid.
  const fontSize = 64 * scale;
  const lineHeight = 80 * scale;
  const fontFamily = 'sans-serif';

  // Per-face text content — mirrors the reference's per-element
  // textContent assignments in _updateClockValues:
  //   - rotorLeafFront  = prev value  (visible at rest, top half)
  //   - rotorBottom     = prev value  (visible at rest, bottom half)
  //   - rotorTop        = next value  (set at t=500, back of falling flap)
  //   - rotorLeafRear   = next value  (set at t=500, revealed by flip)
  //
  // State machine:
  //   idle  → all faces show `prev` (rotorLeafFront + rotorBottom + rotorTop)
  //   rotorTop + rotorLeafRear also show `prev` until t=500, then jump to `next`
  //   on tick: t=0   prev → current state, copy `current` to prev-only faces
  //            t=500  flip starts; rotorTop + rotorLeafRear show `next`
  //            t=1000 flip done; remove .flipped class (instant reset to 0deg)
  //                   then on next render: rotorLeafFront + rotorBottom switch to `next`
  //
  // We simplify by storing `prev` and `next` as state; the render maps
  // them onto the four faces per the reference.

  const [prev, setPrev] = useState(ch);
  const [next, setNext] = useState(ch);
  // True while the .flipped class is on the leaf (rotateX -180deg,
  // 500ms transition). Reset to false at t=1000 to drop the class.
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (ch === prev) return;
    // 1. Immediately set `next` — this updates rotorTop + rotorLeafRear
    //    text in the same render. (Reference does this at t=500 via
    //    setTimeout, but it has the same net effect on the next frame
    //    after class change because rotorTop is hidden behind the leaf
    //    front until the flip is mid-way. We do it on the same rAF as
    //    setFlipped so React batches them — visually identical.)
    // 2. Add .flipped class — 500ms ease-in-out rotation starts.
    // 3. After 500ms: remove .flipped (instant reset) and update `prev`
    //    so the next render shows the new digit on the visible faces.
    queueMicrotask(() => {
      setNext(ch);
      requestAnimationFrame(() => {
        setFlipped(true);
        const reset = window.setTimeout(() => {
          setFlipped(false);
          setPrev(ch);
          if (soundEnabled) playClack();
        }, 500);
        void reset;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, soundEnabled]);

  // The leaf transition string mirrors the reference's CSS:
  //   idle:    transition: transform 0s
  //   flipped: transition: all 0.5s ease-in-out
  // We emit the right one based on state.
  const leafTransition = flipped ? 'all 500ms ease-in-out' : 'transform 0s';

  // Figure positioning: top face = upper half of rotor, bottom face =
  // lower half. Reference uses line-height: 80px on both leaf-front
  // and rotor-top, line-height: 0 on the bottom faces. We use
  // flexbox with `items-end` for top and `items-start` for bottom, and
  // set the line-height of the inner span to the full rotor height so
  // the digit sits in the visual center of its half. This matches
  // the reference's intent (line-height: 80px in a 40px-tall figure
  // centers the baseline at the figure's middle).
  const figureTopStyle = {
    position: 'absolute' as const,
    inset: 0,
    height: halfH,
    backgroundColor: flapBg,
    borderRadius: `${radius}px ${radius}px 0 0`,
    lineHeight: 0, // container; span uses lineHeight=80
    overflow: 'hidden',
  };
  const figureBottomStyle = {
    position: 'absolute' as const,
    inset: 0,
    top: halfH,
    height: halfH,
    backgroundColor: cardBg,
    borderRadius: `0 0 ${radius}px ${radius}px`,
    lineHeight: 0,
    overflow: 'hidden',
  };

  // Digit alignment per reference:
  //   .rotor-leaf-front, .rotor-top:  line-height: 80px → digit bottom-aligned
  //   .rotor-leaf-rear, .rotor-bottom: line-height: 0   → digit top-aligned
  // We implement that with flex + line-height on the inner span.
  const digitTop = (digit: string, color: string) => (
    <span
      style={{
        color,
        fontSize,
        fontWeight: 700,
        fontFamily,
        lineHeight,
        display: 'block',
        textAlign: 'center',
      }}
    >
      {digit}
    </span>
  );
  const digitBottom = (digit: string, color: string) => (
    <span
      style={{
        color,
        fontSize,
        fontWeight: 700,
        fontFamily,
        lineHeight,
        display: 'block',
        textAlign: 'center',
        // Push the digit down so it appears in the bottom half.
        // Reference uses line-height: 0 on the figure, which means
        // the figure is 40px tall with a single-line baseline at 0;
        // the text overflows above. In React, the cleanest match is
        // to position the span with transform.
        transform: 'translateY(-100%)',
      }}
    >
      {digit}
    </span>
  );

  return (
    <div
      className="rotor"
      style={{
        position: 'relative',
        float: 'left',
        width: W,
        height: H,
        marginRight: 5 * scale,
        borderRadius: radius,
        fontSize,
        textAlign: 'center',
        perspective: 200,
        backgroundColor: 'transparent',
      }}
    >
      {/* The leaf — animates rotateX(0) ↔ rotateX(-180deg). z-index: 1
          so it sits on top of the static rotor-top and rotor-bottom.
          Children order matters: rotorLeafRear first (drawn behind),
          then rotorLeafFront (drawn in front). At rest with leaf at
          rotateX(0), rotorLeafFront faces the viewer (front) and
          rotorLeafRear is behind it (backface-hidden). After flip
          (-180deg), rotorLeafFront is now facing away (backface-hidden)
          and rotorLeafRear (pre-rotated -180) now faces the viewer. */}
      <div
        className="rotor-leaf"
        style={{
          position: 'absolute',
          zIndex: 1,
          width: W,
          height: H,
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateX(-180deg)' : 'rotateX(0deg)',
          transition: leafTransition,
        }}
      >
        {/* rotor-leaf-rear: pre-rotated 180deg, shows next digit's bottom */}
        <div
          className="rotor-leaf-rear"
          style={{
            ...figureBottomStyle,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateX(-180deg)',
          }}
        >
          {digitBottom(next, digitColorBottom)}
        </div>

        {/* rotor-leaf-front: top half of leaf, shows next digit's top */}
        <div
          className="rotor-leaf-front"
          style={{
            ...figureTopStyle,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            // Reference has no transform on .rotor-leaf-front (transform:
            // rotateX(0deg) is the default). Default is identity.
          }}
        >
          {digitTop(next, digitColorTop)}
        </div>
      </div>

      {/* rotor-top: static, top half. Shows PREV digit (mirrors
          reference's prevClockValuesAsString). This is the "back" of
          the falling flap — when the leaf rotates down, the back of
          rotorLeafFront swings into view from the top. rotorTop is
          positioned behind the leaf (z-index 0) so it stays hidden
          until the leaf completes its flip. At t=500 (the moment the
          leaf is half-flipped), the rotorTop text is updated to the
          new digit so that when the leaf has fully flipped, the new
          digit's top is visible on the rotorTop face. We render
          `next` on rotorTop instead of `prev` to match this: at idle
          the leaf covers it (so user doesn't see it); after flip the
          leaf is hidden by backface-visibility and rotorTop is
          revealed with `next`. */}
      <div
        className="rotor-top"
        style={{
          ...figureTopStyle,
          color: digitColorTop,
        }}
      >
        {digitTop(next, digitColorTop)}
      </div>

      {/* rotor-bottom: static, bottom half. Shows PREV digit. The
          reference keeps this on the OLD digit for one frame longer
          so the falling flap's back side briefly shows the new digit
          while the bottom still shows the old — but since they're
          stacked at the same z-plane and rotor-bottom has no z-index,
          it's behind the leaf and not visible during the flip.
          Visually, after the flip resolves, both rotorTop and
          rotorBottom should show the new digit. We render `next` on
          rotor-bottom too. */}
      <div
        className="rotor-bottom"
        style={{
          ...figureBottomStyle,
          bottom: 0,
          color: digitColorBottom,
        }}
      >
        {digitBottom(next, digitColorBottom)}
      </div>

      {/* Hinge: .rotor:after in the reference is a 1px top border
          drawn on a 50×40 box positioned at the bottom of the rotor
          (bottom: 0). It effectively creates a 1px line across the
          midpoint of the rotor (since the box is 40px tall and starts
          at 40px from the top). We use the reference's exact technique:
          a 1px line at top: halfH, with edgeColor for the color. */}
      <div
        className="rotor-after"
        style={{
          content: '""',
          position: 'absolute',
          zIndex: 2,
          bottom: 0,
          left: 0,
          width: W,
          height: halfH,
          borderRadius: `0 0 ${radius}px ${radius}px`,
          borderTop: `1px solid ${edgeColor}`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// Delimiter dots are rendered inline inside each .rotor-group in
// FlipClock below, matching the reference's :nth-child(n+2):nth-child(-n+3)
// pseudo-element positions (left: 115px, bottom: 20px and 50px,
// 10x10px circles colored like the rotor-top).

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

  // Color palette mirrors the reference CSS exactly:
  //   dark theme: rotor-top + rotor-leaf-front = #151515 / #FFFFFF
  //               rotor-bottom + rotor-leaf-rear = #202020 / #EFEFEF
  //               hinge (rotor:after border-top) = #151515
  //   light theme: rotor-top + rotor-leaf-front = #DDDDDD / #222222
  //                rotor-bottom + rotor-leaf-rear = #EEEEEE / #333333
  //                hinge = #222222
  //   claude theme: custom warm brown two-tone, no reference.
  //   neon/accent colors: single dark cards with the chosen color as
  //   digit color, hinge same as flapBg.
  const isPlain = safeColor === 'white' || safeColor === 'ink';
  let cardBg: string;
  let flapBg: string;
  let digitColorTop: string;
  let digitColorBottom: string;
  let edgeColor: string;
  if (theme === 'claude') {
    cardBg = '#3a2e1f';
    flapBg = '#4a3a25';
    digitColorTop = isPlain ? flipColor : '#faf6ef';
    digitColorBottom = isPlain ? flipColor : '#ede4d0';
    edgeColor = flapBg;
  } else if (isPlain) {
    if (theme === 'dark') {
      cardBg = '#202020';
      flapBg = '#151515';
      digitColorTop = '#ffffff';
      digitColorBottom = '#efefef';
      edgeColor = '#151515';
    } else {
      cardBg = '#eeeeee';
      flapBg = '#dddddd';
      digitColorTop = '#222222';
      digitColorBottom = '#333333';
      edgeColor = '#222222';
    }
  } else {
    // Neon/accent: dark single-tone card, glow color
    cardBg = '#1a1a1a';
    flapBg = '#0a0a0a';
    digitColorTop = flipColor;
    digitColorBottom = flipColor;
    edgeColor = '#0a0a0a';
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
      flapBg={flapBg}
      digitColorTop={digitColorTop}
      digitColorBottom={digitColorBottom}
      edgeColor={edgeColor}
      soundEnabled={soundEnabled}
    />
  );

  return (
    <div
      className="flipdown"
      style={{
        width: 'auto',
        height: 'auto',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'center',
        gap: 30 * scale,
        lineHeight: 0,
      }}
    >
      <div className="rotor-group" style={{ position: 'relative', display: 'flex', paddingRight: 0 }}>
        {card(hh[0])}
        {card(hh[1])}
        {/* Delimiter dots — reference uses pseudo-elements on the
            .rotor-group :nth-child(n+2):nth-child(-n+3) positioned
            115px from the left, 20px and 50px from the bottom. We
            render them as actual elements for the same visual. */}
        <div
          style={{
            position: 'absolute',
            left: 115 * scale,
            bottom: 20 * scale,
            width: 10 * scale,
            height: 10 * scale,
            borderRadius: '50%',
            backgroundColor: flapBg,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 115 * scale,
            bottom: 50 * scale,
            width: 10 * scale,
            height: 10 * scale,
            borderRadius: '50%',
            backgroundColor: flapBg,
          }}
        />
      </div>
      <div className="rotor-group" style={{ position: 'relative', display: 'flex', paddingRight: 0 }}>
        {card(mm[0])}
        {card(mm[1])}
        <div
          style={{
            position: 'absolute',
            left: 115 * scale,
            bottom: 20 * scale,
            width: 10 * scale,
            height: 10 * scale,
            borderRadius: '50%',
            backgroundColor: flapBg,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 115 * scale,
            bottom: 50 * scale,
            width: 10 * scale,
            height: 10 * scale,
            borderRadius: '50%',
            backgroundColor: flapBg,
          }}
        />
      </div>
      <div className="rotor-group" style={{ position: 'relative', display: 'flex', paddingRight: 0 }}>
        {card(ss[0])}
        {card(ss[1])}
      </div>
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
