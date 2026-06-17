// Retro 7-segment clock — uses the "Seven Segment" font loaded in
// index.css for proper segment shapes (not a hand-rolled SVG).
// Loaded lazily by Clock.tsx so users who don't pick "retro" don't
// pay for it in the initial bundle.

import { getColor, getSizeScale, safeDarkBgColor, type ClockColor, type ClockSize } from './clock-constants';

export function RetroClock({
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
  const baseScale = getSizeScale(sizeProp);
  // Retro clock has its own dark background — force a visible color.
  const safeColor = safeDarkBgColor(color);
  const hex = getColor(safeColor, customHex);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const isPlain = safeColor === 'white' || safeColor === 'ink';
  const fontSize = 110 * baseScale;
  const colonFontSize = 110 * baseScale;
  // Fixed-width digit cells. Real 7-segment displays reserve a slot
  // per digit so "1" doesn't shrink the frame relative to "8". We
  // use `tabular-nums` for proportional digits and lock each digit
  // into a fixed-width inline-block so the overall frame is constant.
  const digitW = 0.62 * fontSize; // matches 7-seg digit aspect (0.6:1)
  const colonW = 0.5 * colonFontSize;

  // On-segment glow for neon/LED colors. Plain (white/ink) stays flat.
  const textShadow = isPlain ? undefined : `0 0 ${10 * baseScale}px ${hex}aa, 0 0 ${20 * baseScale}px ${hex}55`;

  return (
    <div
      className="p-6 rounded-2xl border-2 inline-block"
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
        {hh.split('').map((ch, i) => (
          <span key={`h${i}`} style={{ fontSize, width: digitW, display: 'inline-block', textAlign: 'center' }}>
            {ch}
          </span>
        ))}
        <span style={{ fontSize: colonFontSize, width: colonW, display: 'inline-block', textAlign: 'center', marginInline: `${4 * baseScale}px` }}>:</span>
        {mm.split('').map((ch, i) => (
          <span key={`m${i}`} style={{ fontSize, width: digitW, display: 'inline-block', textAlign: 'center' }}>
            {ch}
          </span>
        ))}
        <span style={{ fontSize: colonFontSize, width: colonW, display: 'inline-block', textAlign: 'center', marginInline: `${4 * baseScale}px` }}>:</span>
        {ss.split('').map((ch, i) => (
          <span key={`s${i}`} style={{ fontSize, width: digitW, display: 'inline-block', textAlign: 'center' }}>
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}
