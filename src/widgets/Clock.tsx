import { useEffect, useState } from 'react';

export type ClockStyle = 'digital' | 'analog' | 'retro' | 'flip';
export type ClockColor = 'white' | 'ink' | 'amber' | 'green' | 'cyan' | 'red' | 'pink';
export type ClockSize = 'sm' | 'md' | 'lg' | 'xl';

export const CLOCK_STYLES: ClockStyle[] = ['digital', 'analog', 'retro', 'flip'];
export const CLOCK_SIZES: { id: ClockSize; label: string; scale: number }[] = [
  { id: 'sm', label: 'Small', scale: 0.7 },
  { id: 'md', label: 'Medium', scale: 1 },
  { id: 'lg', label: 'Large', scale: 1.3 },
  { id: 'xl', label: 'X-Large', scale: 1.7 },
];
export const CLOCK_COLORS: { id: ClockColor; label: string; hex: string }[] = [
  { id: 'white', label: 'White', hex: '#ffffff' },
  { id: 'ink', label: 'Ink', hex: '#0a0a0a' },
  { id: 'amber', label: 'Amber', hex: '#ffb000' },
  { id: 'green', label: 'Green', hex: '#33ff66' },
  { id: 'cyan', label: 'Cyan', hex: '#00e5ff' },
  { id: 'red', label: 'Red', hex: '#ff3344' },
  { id: 'pink', label: 'Pink', hex: '#ff66cc' },
];

export function getColor(color: ClockColor, _dim = 0.4): string {
  const c = CLOCK_COLORS.find((x) => x.id === color);
  if (!c) return '#ffffff';
  return c.hex;
}

export function getSizeScale(size: ClockSize): number {
  return CLOCK_SIZES.find((s) => s.id === size)?.scale ?? 1;
}

export function DigitalClock({
  style = 'digital',
  color = 'white',
  theme = 'dark',
  size = 'md',
}: {
  style?: ClockStyle;
  color?: ClockColor;
  theme?: 'dark' | 'light' | 'claude';
  size?: ClockSize;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // In light mode, swap 'white' to a dark ink color so text stays readable
  let effectiveColor: ClockColor = color;
  if (theme !== 'dark' && color === 'white') effectiveColor = 'ink';
  if (style === 'analog') return <AnalogClock color={effectiveColor} now={now} size={size} />;
  if (style === 'retro') return <RetroClock color={effectiveColor} now={now} size={size} />;
  if (style === 'flip') return <FlipClock color={effectiveColor} now={now} theme={theme} size={size} />;

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const c = getColor(effectiveColor);
  const isPlain = effectiveColor === 'white' || effectiveColor === 'ink';
  const scale = getSizeScale(size);

  return (
    <div className="font-mono" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
      <div
        className="text-9xl font-thin tracking-tighter tabular-nums"
        style={{ color: c, textShadow: isPlain ? undefined : `0 0 30px ${c}66` }}
      >
        {hh}<span style={{ opacity: 0.3 }}>:</span>{mm}<span style={{ opacity: 0.5 }}>:{ss}</span>
      </div>
    </div>
  );
}

function AnalogClock({ color, now, size: sizeProp = 'md' }: { color: ClockColor; now: Date; size?: ClockSize }) {
  const size = 280 * getSizeScale(sizeProp);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const c = getColor(color);
  const dim = getColor(color);

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

  const hand = (angle: number, length: number, width: number) => ({
    x2: cx + length * Math.cos(angle),
    y2: cy + length * Math.sin(angle),
    sw: width,
  });

  const hh = hand(hourAngle, hourLen, 6);
  const mm = hand(minAngle, minLen, 4);
  const ss = hand(secAngle, secLen, 2);

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

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-2xl">
      {/* outer ring */}
      <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={c} strokeWidth={2} opacity={0.8} />
      <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke={c} strokeWidth={1} opacity={0.3} />

      {/* ticks */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={c}
          strokeWidth={t.isHour ? 2.5 : 1}
          opacity={t.isHour ? 0.9 : 0.4}
        />
      ))}

      {/* hour numbers */}
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
            fill={c}
            fontSize={20}
            fontFamily="serif"
            fontWeight={500}
          >
            {i + 1}
          </text>
        );
      })}

      {/* hands */}
      <line x1={cx} y1={cy} x2={hh.x2} y2={hh.y2} stroke={c} strokeWidth={hh.sw} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={mm.x2} y2={mm.y2} stroke={c} strokeWidth={mm.sw} strokeLinecap="round" />
      <line
        x1={cx}
        y1={cy}
        x2={ss.x2}
        y2={ss.y2}
        stroke={color === 'red' ? c : dim}
        strokeWidth={ss.sw}
        strokeLinecap="round"
        opacity={color === 'red' ? 1 : 0.7}
      />

      {/* center */}
      <circle cx={cx} cy={cy} r={6} fill={c} />
      <circle cx={cx} cy={cy} r={2} fill="black" />
    </svg>
  );
}

function RetroClock({ color, now, size: sizeProp = 'md' }: { color: ClockColor; now: Date; size?: ClockSize }) {
  const baseScale = getSizeScale(sizeProp);
  const c = getColor(color);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  // 7-segment digit maps
  const segMap: Record<string, number[]> = {
    '0': [1, 1, 1, 1, 1, 1, 0],
    '1': [0, 1, 1, 0, 0, 0, 0],
    '2': [1, 1, 0, 1, 1, 0, 1],
    '3': [1, 1, 1, 1, 0, 0, 1],
    '4': [0, 1, 1, 0, 0, 1, 1],
    '5': [1, 0, 1, 1, 0, 1, 1],
    '6': [1, 0, 1, 1, 1, 1, 1],
    '7': [1, 1, 1, 0, 0, 0, 0],
    '8': [1, 1, 1, 1, 1, 1, 1],
    '9': [1, 1, 1, 1, 0, 1, 1],
  };

  const Digit = ({ ch, scale = 1 }: { ch: string; scale?: number }) => {
    const s = scale * baseScale;
    const w = 60 * s;
    const h = 100 * s;
    const t = 8 * s;
    const segs = segMap[ch] || [0, 0, 0, 0, 0, 0, 0];
    const on = (i: number) => (segs[i] ? c : `${c}22`);
    // segments: 0=top, 1=tr, 2=br, 3=bot, 4=bl, 5=tl, 6=mid
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* top */}
        <polygon points={`${t},0 ${w - t},0 ${w - 2 * t},${t} ${2 * t},${t}`} fill={on(0)} />
        {/* top-right */}
        <polygon points={`${w},${t} ${w},${h / 2 - t / 2} ${w - t},${h / 2} ${w - t},${2 * t}`} fill={on(1)} />
        {/* bottom-right */}
        <polygon
          points={`${w},${h / 2 + t / 2} ${w},${h - t} ${w - t},${h} ${w - t},${h / 2}`}
          fill={on(2)}
        />
        {/* bottom */}
        <polygon
          points={`${t},${h} ${w - t},${h} ${w - 2 * t},${h - t} ${2 * t},${h - t}`}
          fill={on(3)}
        />
        {/* bottom-left */}
        <polygon points={`0,${h - t} 0,${h / 2 + t / 2} ${t},${h / 2} ${t},${h - 2 * t}`} fill={on(4)} />
        {/* top-left */}
        <polygon points={`0,${t} 0,${h / 2 - t / 2} ${t},${h / 2} ${t},${2 * t}`} fill={on(5)} />
        {/* middle */}
        <polygon
          points={`${t},${h / 2} ${2 * t},${h / 2 - t / 2} ${w - 2 * t},${h / 2 - t / 2} ${w - t},${h / 2} ${w - 2 * t},${h / 2 + t / 2} ${2 * t},${h / 2 + t / 2}`}
          fill={on(6)}
        />
      </svg>
    );
  };

  const Colon = () => {
    const s = 8 * baseScale;
    return (
      <svg width={s} height={100 * baseScale} viewBox={`0 0 ${s} ${100 * baseScale}`}>
        <circle cx={s / 2} cy={30 * baseScale} r={s / 2} fill={c} />
        <circle cx={s / 2} cy={70 * baseScale} r={s / 2} fill={c} />
      </svg>
    );
  };

  return (
    <div
      className="p-6 rounded-2xl border-2"
      style={{
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderColor: `${c}44`,
        boxShadow: `0 0 40px ${c}33, inset 0 0 20px ${c}1a`,
      }}
    >
      <div className="flex items-center gap-3">
        <Digit ch={hh[0]} />
        <Digit ch={hh[1]} />
        <Colon />
        <Digit ch={mm[0]} />
        <Digit ch={mm[1]} />
        <Colon />
        <div className="flex flex-col gap-1">
          <Digit ch={ss[0]} scale={0.5} />
          <Digit ch={ss[1]} scale={0.5} />
        </div>
      </div>
    </div>
  );
}

function FlipClock({
  color,
  now,
  theme,
  size: sizeProp = 'md',
}: {
  color: ClockColor;
  now: Date;
  theme: 'dark' | 'light' | 'claude';
  size?: ClockSize;
}) {
  const scale = getSizeScale(sizeProp);
  const c = getColor(color);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  // card width/height scaled
  const W = 100 * scale;
  const H = 160 * scale;
  const gap = 8 * scale;
  const cardRadius = 10 * scale;
  const flapPadding = 4 * scale;
  const fontSize = 86 * scale;
  const colonSize = 24 * scale;

  // Theme-aware card colors
  const isPlain = color === 'white' || color === 'ink';
  let cardBg, flapBg, edgeColor, digitColor, shadowColor;
  if (theme === 'claude') {
    cardBg = '#3a2e1f';
    flapBg = '#4a3a25';
    edgeColor = '#5a4530';
    digitColor = isPlain ? c : '#faf6ef';
    shadowColor = 'rgba(0,0,0,0.3)';
  } else {
    cardBg = isPlain ? (theme === 'dark' ? '#1a1a1a' : '#2a2a2a') : '#1a1a1a';
    flapBg = isPlain ? (theme === 'dark' ? '#0a0a0a' : '#1a1a1a') : '#0a0a0a';
    edgeColor = isPlain ? (theme === 'dark' ? '#2a2a2a' : '#3a3a3a') : '#2a2a2a';
    digitColor = isPlain ? c : c;
    shadowColor = `${c}33`;
  }

  const FlipCard = ({ ch }: { ch: string }) => {
    // Realistic split-flap (Solari board) technique:
    // - Static top half shows NEXT digit (revealed when card rotates past -90deg)
    // - Static bottom half shows CURRENT digit
    // - Single 50%-height card has front=CURRENT, back=NEXT, rotates 0 -> -180deg around bottom edge
    // - On transition end, commit the new digit
    const [digit, setDigit] = useState({ current: ch, next: ch });
    const [flipped, setFlipped] = useState(false);

    useEffect(() => {
      if (digit.current !== ch && !flipped) {
        setDigit((d) => ({ current: d.current, next: ch }));
        setFlipped(true);
      }
    }, [ch, digit.current, flipped]);

    const handleTransitionEnd = () => {
      setDigit({ current: digit.next, next: ch });
      setFlipped(false);
    };

    const digitStyle = {
      fontSize,
      color: digitColor,
      fontWeight: 700,
      lineHeight: 1,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontVariantNumeric: 'tabular-nums',
      textShadow: !isPlain ? `0 0 ${12 * scale}px ${c}66` : undefined,
    } as const;

    // Lighting tones — light source from above. Top flap's bottom edge darkens as it tilts down;
    // back face (next) starts dark (paper's underside) and brightens as it swings into view.
    const flapShadowDark = isPlain ? 'rgba(0,0,0,0.55)' : `${c}33`;
    const flapShadowLight = isPlain ? 'rgba(255,255,255,0.08)' : `${c}22`;

    return (
      <div
        className="relative"
        style={{
          width: W,
          height: H,
          borderRadius: cardRadius,
          perspective: 1200,
          backgroundColor: 'transparent',
          boxShadow: `0 ${6 * scale}px ${14 * scale}px ${shadowColor}, inset 0 0 0 1px ${edgeColor}`,
        }}
      >
        {/* Static top half — shows NEXT (revealed once card rotates past -90deg).
            Inner shadow at bottom gives the slot depth where the flap came from. */}
        <div
          className="absolute inset-x-0 top-0 flex items-end justify-center overflow-hidden"
          style={{
            height: H / 2,
            backgroundColor: flapBg,
            borderRadius: `${cardRadius}px ${cardRadius}px 0 0`,
            boxShadow: `inset 0 -${2 * scale}px ${4 * scale}px ${flapShadowDark}`,
          }}
        >
          <span style={{ ...digitStyle, transform: 'translateY(50%)' }}>{digit.next}</span>
        </div>

        {/* Static bottom half — shows CURRENT. Inner top shadow = the slot the flap descends into. */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-start justify-center overflow-hidden"
          style={{
            height: H / 2,
            backgroundColor: cardBg,
            borderRadius: `0 0 ${cardRadius}px ${cardRadius}px`,
            boxShadow: `inset 0 ${3 * scale}px ${6 * scale}px ${flapShadowDark}, inset 0 -1px 0 ${flapShadowLight}`,
          }}
        >
          <span style={{ ...digitStyle, transform: 'translateY(-50%)' }}>{digit.current}</span>
        </div>

        {/* Flipping card — 50% height, top half, rotates around bottom edge.
            cubic-bezier(0.5, 0.05, 0.35, 1.05) gives a slight overshoot at end (mechanical settle). */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: H / 2,
            transformStyle: 'preserve-3d',
            transformOrigin: 'bottom',
            transition: 'transform 380ms cubic-bezier(0.5, 0.05, 0.35, 1.05)',
            transform: flipped ? 'rotateX(-180deg)' : 'rotateX(0deg)',
            zIndex: 2,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {/* Front face — CURRENT (visible at rest and during 0 → -90 phase).
              Top inner shadow mimics light falling off as flap tilts. */}
          <div
            className="absolute inset-0 flex items-end justify-center overflow-hidden"
            style={{
              backgroundColor: flapBg,
              borderRadius: `${cardRadius}px ${cardRadius}px 0 0`,
              backfaceVisibility: 'hidden',
              boxShadow: `inset 0 ${2 * scale}px ${5 * scale}px ${flapShadowDark}`,
            }}
          >
            <span style={{ ...digitStyle, transform: 'translateY(50%)' }}>{digit.current}</span>
          </div>
          {/* Back face — NEXT, pre-rotated 180deg. Revealed as flap swings past -90deg. */}
          <div
            className="absolute inset-0 flex items-end justify-center overflow-hidden"
            style={{
              backgroundColor: flapBg,
              borderRadius: `${cardRadius}px ${cardRadius}px 0 0`,
              backfaceVisibility: 'hidden',
              transform: 'rotateX(180deg)',
              boxShadow: `inset 0 -${1 * scale}px ${3 * scale}px ${flapShadowLight}`,
            }}
          >
            <span style={{ ...digitStyle, transform: 'translateY(50%)' }}>{digit.next}</span>
          </div>
        </div>

        {/* Soft cast shadow under the card — shrinks during the flip as the flap moves away */}
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{
            top: H / 2,
            height: H / 2,
            background: `linear-gradient(to bottom, ${flapShadowDark}, transparent 70%)`,
            transformOrigin: 'top',
            transform: flipped ? 'scaleY(0.4)' : 'scaleY(0.7)',
            transition: 'transform 380ms cubic-bezier(0.5, 0.05, 0.35, 1.05)',
            zIndex: 1,
            opacity: 0.6,
            borderRadius: `0 0 ${cardRadius}px ${cardRadius}px`,
          }}
        />

        {/* Horizontal divider line at center — sharp edge with subtle bottom shadow for slot depth */}
        <div
          className="absolute inset-x-0 top-1/2 pointer-events-none"
          style={{
            height: 1,
            backgroundColor: edgeColor,
            transform: 'translateY(-0.5px)',
            zIndex: 4,
            boxShadow: `0 1px 0 ${flapShadowDark}`,
          }}
        />
      </div>
    );
  };

  const Colon = () => (
    <div
      className="flex flex-col items-center justify-center"
      style={{ gap: gap, height: H, padding: `${flapPadding}px 0` }}
    >
      <div
        className="rounded-full"
        style={{ width: colonSize * 0.35, height: colonSize * 0.35, backgroundColor: digitColor }}
      />
      <div
        className="rounded-full"
        style={{ width: colonSize * 0.35, height: colonSize * 0.35, backgroundColor: digitColor }}
      />
    </div>
  );

  return (
    <>
      <div className="flex items-center" style={{ gap }}>
        <FlipCard ch={hh[0]} />
        <FlipCard ch={hh[1]} />
        <Colon />
        <FlipCard ch={mm[0]} />
        <FlipCard ch={mm[1]} />
        <Colon />
        <FlipCard ch={ss[0]} />
        <FlipCard ch={ss[1]} />
      </div>
    </>
  );
}

export function WorldClock({ color = 'white', theme = 'dark' }: { color?: ClockColor; theme?: 'dark' | 'light' | 'claude' }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cities = [
    { name: 'NYC', tz: 'America/New_York' },
    { name: 'LDN', tz: 'Europe/London' },
    { name: 'TYO', tz: 'Asia/Tokyo' },
    { name: 'JAK', tz: 'Asia/Jakarta' },
    { name: 'SYD', tz: 'Australia/Sydney' },
  ];

  const format = (tz: string) => {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      hour12: false,
    }).format(now);
  };

  const effectiveColor: ClockColor = theme !== 'dark' && color === 'white' ? 'ink' : color;
  const c = getColor(effectiveColor);
  const label = theme === 'dark' ? 'text-white/70' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'text-black/70';
  const inactive = c;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
      {cities.map((city) => (
        <div key={city.name} className="text-center">
          <div className={`text-xs mb-1 ${label}`}>{city.name}</div>
          <div className="text-2xl tabular-nums tracking-tight" style={{ color: inactive }}>
            {format(city.tz)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DateDisplay({ theme = 'dark' }: { theme?: 'dark' | 'light' | 'claude' }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const label = theme === 'dark' ? 'text-white/60' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'text-black/70';
  const main = theme === 'dark' ? 'text-white' : theme === 'claude' ? 'text-[#3a2e1f]' : 'text-black';

  return (
    <div className="text-center">
      <div className={`text-2xl font-light tracking-wide ${main}`}>{dayName}</div>
      <div className={`text-sm mt-1 ${label}`}>{dateStr}</div>
    </div>
  );
}
