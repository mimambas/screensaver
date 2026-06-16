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
// Flip clock — FlipDown.js style
//   - Card 50:80 aspect (W:H = 5:8) with 4px corner radius
//   - Top half: flapBg, bottom half: cardBg — subtle two-tone like #151515/#202020
//   - Digit top white-ish, digit bottom off-white-ish — subtle two-tone like #FFF/#EFEFEF
//   - Hinge: 1px line at midpoint (drawn by parent via box-shadow; we expose nothing)
//   - Animation: 500ms ease-in-out rotateX(-180deg), perspective 200px on the card
//   - backface-visibility: hidden on both leaf faces
// --------------------------------------------------------------------------

function FlipDigit({
  ch,
  scale,
  cardBg,
  flapBg,
  digitColorTop,
  digitColorBottom,
  soundEnabled,
}: {
  ch: string;
  scale: number;
  cardBg: string;
  flapBg: string;
  digitColorTop: string;
  digitColorBottom: string;
  soundEnabled: boolean;
}) {
  // 5:8 aspect ratio like the reference (50x80 at scale=1).
  const W = 50 * scale;
  const H = 80 * scale;
  const halfH = H / 2;
  const radius = 4 * scale;
  const fontSize = 64 * scale; // 4rem at scale=1 ≈ 64px

  // FlipDown reference (https://github.com/PButcher/flipdown) defines
  // 5 faces per rotor, all positioned absolutely inside the .rotor:
  //   1. .rotor-top          — static, top half, shows CURRENT digit
  //                            on the back side of the falling flap.
  //                            (The "old" top, behind the leaf front.)
  //   2. .rotor-bottom       — static, bottom half, shows CURRENT digit.
  //   3. .rotor-leaf-front   — child of .rotor-leaf, top half face.
  //                            Initially HIDDEN (rotated 0deg means
  //                            visible, but parent leaf is at 0deg too
  //                            so... wait, reference: leaf starts at
  //                            rotateX(0) and front-face is also at
  //                            rotateX(0) with no backface-hidden on
  //                            the leaf itself; the leaf covers the
  //                            rotor-top initially).
  //   4. .rotor-leaf-rear    — child of .rotor-leaf, bottom half face,
  //                            pre-rotated rotateX(-180deg) so it shows
  //                            the bottom of the new digit once the
  //                            leaf is flipped.
  //   5. .rotor-leaf         — the parent, animates rotateX(0) →
  //                            rotateX(-180deg) over 500ms.
  //
  // Reference DOM (from flipdown.js _createRotor):
  //   <div class="rotor">
  //     <div class="rotor-leaf">           <!-- animates -->
  //       <figure class="rotor-leaf-rear"/>   <!-- bottom-half, pre-rotated -->
  //       <figure class="rotor-leaf-front"/>  <!-- top-half, rotates with leaf -->
  //     </div>
  //     <div class="rotor-top"/>           <!-- static, current top -->
  //     <div class="rotor-bottom"/>        <!-- static, current bottom -->
  //   </div>
  //
  // The hinge is drawn by .rotor:after — a 1px top border at the
  // bottom of the rotor (i.e. across the lower half's top edge, which
  // is the actual hinge line). We mirror that with a 1px line at
  // top: 50% of the card.

  const [current, setCurrent] = useState(ch);
  const [next, setNext] = useState(ch);
  // Mirrors the .flipped class on .rotor-leaf. When true, the leaf has
  // rotateX(-180deg); when false, rotateX(0deg). The transition is
  // unconditional: "all 0.5s ease-in-out" per the reference CSS.
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (ch === current) return;
    // Match the reference's two-step setTimeout(..., 500) pattern:
    //   - At t=0: rotor-top text is set to the NEW digit (so when the
    //     leaf flips, the back side of the falling top-half shows the
    //     new digit immediately, making the falling flap appear to
    //     reveal the new top from underneath).
    //   - At t=500ms: rotor-leaf-rear text is set to the new digit
    //     AND the .flipped class is toggled, animating the leaf
    //     rotation 0 → -180.
    // The setNext/setFlipped happen on the same rAF, but the text
    // updates on the .rotor-top (the static back side of the falling
    // flap) need to commit BEFORE the animation starts so React
    // doesn't batch them in the wrong order.
    queueMicrotask(() => {
      setNext(ch);
      requestAnimationFrame(() => {
        setFlipped(true);
        const t = window.setTimeout(() => {
          setCurrent(ch);
          setFlipped(false);
          if (soundEnabled) playClack();
        }, 500);
        void t;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, soundEnabled]);

  const fontFamily = 'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

  // The reference uses "all 0.5s ease-in-out" on the flipped state and
  // "transform 0s" on the idle state. React inline-style can't toggle
  // like a CSS class, so we emit the transition string matching the
  // active state: full transition when flipped (animating), no
  // transition when idle (instant reset).
  const leafStyle = flipped
    ? 'transform 500ms ease-in-out, all 500ms ease-in-out'
    : 'transform 0s ease-in-out';

  return (
    <div
      className="relative float-left"
      style={{
        width: W,
        height: H,
        marginRight: 5 * scale,
        perspective: 200,
        backgroundColor: 'transparent',
      }}
    >
      {/* The leaf — animates rotateX(0) ↔ rotateX(-180deg) over 500ms.
          z-index 1, sits on top of the static rotor-top/rotor-bottom
          (which are z-index 0). At rest, the leaf covers them; after
          the flip, backface-visibility hides the leaf and the static
          faces become visible from the front. */}
      <div
        className="absolute"
        style={{
          inset: 0,
          zIndex: 1,
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateX(-180deg)' : 'rotateX(0deg)',
          transition: leafStyle,
        }}
      >
        {/* rotor-leaf-rear: pre-rotated 180deg so it shows the
            bottom half of the new digit when the leaf has flipped. */}
        <div
          className="absolute overflow-hidden flex items-start justify-center"
          style={{
            inset: 0,
            top: halfH,
            height: halfH,
            backgroundColor: cardBg,
            borderRadius: `0 0 ${radius}px ${radius}px`,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateX(-180deg)',
            lineHeight: 0,
          }}
        >
          <span
            style={{
              color: digitColorBottom,
              fontSize,
              fontWeight: 700,
              fontFamily,
              lineHeight: 1,
              transform: 'translateY(-50%)',
            }}
          >
            {next}
          </span>
        </div>

        {/* rotor-leaf-front: the top half of the leaf, visible at
            rest (rotateX 0), hidden after the flip. */}
        <div
          className="absolute overflow-hidden flex items-end justify-center"
          style={{
            inset: 0,
            height: halfH,
            backgroundColor: flapBg,
            borderRadius: `${radius}px ${radius}px 0 0`,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            lineHeight: 0,
          }}
        >
          <span
            style={{
              color: digitColorTop,
              fontSize,
              fontWeight: 700,
              fontFamily,
              lineHeight: 1,
              transform: 'translateY(50%)',
            }}
          >
            {next}
          </span>
        </div>
      </div>

      {/* rotor-top: static, top half. Shows CURRENT digit. The
          reference's rotor-top is the "back" of the falling flap —
          the falling front face (rotor-leaf-front) covers it during
          the rotation. After the leaf settles at -180, the leaf-front
          is hidden by backface-visibility and rotor-top remains
          visible from the front. */}
      <div
        className="absolute overflow-hidden flex items-end justify-center"
        style={{
          inset: 0,
          height: halfH,
          backgroundColor: flapBg,
          borderRadius: `${radius}px ${radius}px 0 0`,
          lineHeight: 0,
        }}
      >
        <span
          style={{
            color: digitColorTop,
            fontSize,
            fontWeight: 700,
            fontFamily,
            lineHeight: 1,
            transform: 'translateY(50%)',
          }}
        >
          {current}
        </span>
      </div>

      {/* rotor-bottom: static, bottom half. Shows CURRENT digit. */}
      <div
        className="absolute overflow-hidden flex items-start justify-center"
        style={{
          inset: 0,
          top: halfH,
          height: halfH,
          backgroundColor: cardBg,
          borderRadius: `0 0 ${radius}px ${radius}px`,
          lineHeight: 0,
        }}
      >
        <span
          style={{
            color: digitColorBottom,
            fontSize,
            fontWeight: 700,
            fontFamily,
            lineHeight: 1,
            transform: 'translateY(-50%)',
          }}
        >
          {current}
        </span>
      </div>

      {/* Hinge — reference uses .rotor:after with a 1px top border
          positioned at the bottom of the rotor (40px from the top, i.e.
          at the midpoint). We draw it as a thin line across the middle
          using flapBg to create the "split" look. */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: halfH,
          height: 1,
          backgroundColor: flapBg,
          transform: 'translateY(-0.5px)',
          zIndex: 3,
          boxShadow: `0 -1px 0 rgba(0,0,0,0.4)`,
        }}
      />
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
  const dotSize = 10 * scale;
  return (
    <div
      className="flex flex-col items-center justify-center self-center"
      style={{ height: H, gap: 10 * scale, padding: `${6 * scale}px 0` }}
    >
      <div className="rounded-full" style={{ width: dotSize, height: dotSize, backgroundColor: color }} />
      <div className="rounded-full" style={{ width: dotSize, height: dotSize, backgroundColor: color }} />
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

  // FlipDown reference: top half slightly lighter than bottom half
  // (e.g. #151515 vs #202020 for dark). Top digit pure white, bottom
  // digit off-white. Mimic that two-tone for the dark theme; for other
  // themes and neon colors, fall back to a single color.
  const isPlain = safeColor === 'white' || safeColor === 'ink';
  let cardBg: string;
  let flapBg: string;
  let digitColorTop: string;
  let digitColorBottom: string;
  if (theme === 'claude') {
    cardBg = '#3a2e1f';
    flapBg = '#4a3a25';
    digitColorTop = isPlain ? flipColor : '#faf6ef';
    digitColorBottom = isPlain ? flipColor : '#ede4d0';
  } else {
    // Dark theme: subtle two-tone like the reference
    // Light theme: light gray on light gray two-tone
    if (isPlain) {
      cardBg = theme === 'dark' ? '#202020' : '#eeeeee';
      flapBg = theme === 'dark' ? '#151515' : '#dddddd';
      digitColorTop = theme === 'dark' ? '#ffffff' : '#222222';
      digitColorBottom = theme === 'dark' ? '#efefef' : '#333333';
    } else {
      // Neon/accent color: single-tone card with glowing digits
      cardBg = '#1a1a1a';
      flapBg = '#0a0a0a';
      digitColorTop = flipColor;
      digitColorBottom = flipColor;
    }
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
      soundEnabled={soundEnabled}
    />
  );

  return (
    <div
      className="flex items-center"
      style={{ gap: 30 * scale, lineHeight: 0 }}
    >
      <div className="flex">{card(hh[0])}{card(hh[1])}</div>
      <FlipColon scale={scale} color={digitColorTop} />
      <div className="flex">{card(mm[0])}{card(mm[1])}</div>
      <FlipColon scale={scale} color={digitColorTop} />
      <div className="flex">{card(ss[0])}{card(ss[1])}</div>
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
