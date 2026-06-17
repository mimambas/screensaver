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
//
// Loaded lazily by Clock.tsx — heavy due to the 6-card SVG
// animation + WebAudio clack on each minute flip.

import { useEffect, useState } from 'react';
import { getColor, getSizeScale, safeDarkBgColor, type ClockColor, type ClockSize } from './clock-constants';
import { unlockAudio } from './audio';
import { playClack } from './audio';
import { THEMES, type ThemeName } from './theme-presets';

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
  }, [ch, current]);

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

export function FlipClock({
  color,
  customHex,
  now,
  theme,
  size: sizeProp,
  soundEnabled = true,
}: {
  color: ClockColor;
  customHex?: string;
  now: Date;
  theme: ThemeName;
  size?: ClockSize;
  soundEnabled?: boolean;
}) {
  const scale = getSizeScale(sizeProp);
  // Flip clock has its own dark card — force a visible color.
  const safeColor = safeDarkBgColor(color);
  const flipColor = getColor(safeColor, customHex);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  // Color palette (sLeeNguyen defaults: --fcc-background: #0f181a,
  // --fcc-digit-color: #ffffff, --fcc-divider-color: #ffffff66).
  // We tint by theme + selected color.
  const isPlain = safeColor === 'white' || safeColor === 'ink';
  // Card background is "theme's dark card" so digits always read.
  // For dark themes we use a deep neutral; for light themes we use
  // a near-white card. 'claude' is special — its case is its own
  // dark cream so we keep the original palette for that one.
  let cardBg: string;
  let digitColor: string;
  let dividerColor: string;
  if (theme === 'claude') {
    cardBg = '#3a2e1f';
    digitColor = isPlain ? flipColor : '#faf6ef';
    dividerColor = '#faf6ef33';
  } else if (isPlain) {
    if (THEMES[theme].isDark) {
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
