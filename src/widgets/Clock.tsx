// Top-level DigitalClock + the always-on Analog path + the smaller
// secondary widgets (WorldClock, DateDisplay). Heavy clock styles
// (Retro, Flip, Casio) live in their own files and are loaded via
// React.lazy so users who don't pick them don't pay for them in
// the initial bundle.

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CITIES,
  effectiveClockColor,
  getColor,
  getSizeScale,
  type ClockColor,
  type ClockSize,
  type ClockStyle,
  type ThemeName,
} from './clock-constants';
import { THEMES } from './theme-presets';

// Lazy chunks. Each is only fetched the first time the user picks
// that style. Vite emits a separate chunk per file.
const RetroClock = lazy(() => import('./clock-retro').then((m) => ({ default: m.RetroClock })));
const FlipClock = lazy(() => import('./clock-flip').then((m) => ({ default: m.FlipClock })));
const CasioClock = lazy(() => import('./clock-casio').then((m) => ({ default: m.CasioClock })));

function ClockFallback({ style }: { style: ClockStyle }) {
  // Render a small placeholder while the chunk loads. The next
  // tick of the parent's `now` memo will re-render with the real
  // clock mounted.
  return (
    <div
      className="font-mono tabular-nums opacity-50"
      style={{ fontSize: 32 }}
      data-clock-fallback={style}
    >
      …
    </div>
  );
}

export function DigitalClock({
  style = 'digital',
  color = 'white',
  customHex,
  theme = 'dark',
  size,
  soundEnabled = true,
}: {
  style?: ClockStyle;
  color?: ClockColor;
  customHex?: string;
  theme?: ThemeName;
  size?: ClockSize;
  soundEnabled?: boolean;
}) {
  // Tick at 1s when the tab is visible; back off to 1/minute when
  // hidden. Battery saver kicks in when the user walks away.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let id: number;
    const arm = () => {
      const visible = document.visibilityState === 'visible';
      const period = visible ? 1000 : 60_000;
      id = window.setInterval(() => setTick((n) => (n + 1) | 0), period);
    };
    arm();
    const onVis = () => {
      window.clearInterval(id);
      arm();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [tick]);

  const c = effectiveClockColor(color);

  if (style === 'analog') return <AnalogClock color={c} customHex={customHex} now={now} size={size} />;

  // Lazy chunks below — show a tiny fallback while the import resolves.
  if (style === 'retro') {
    return (
      <Suspense fallback={<ClockFallback style="retro" />}>
        <RetroClock color={c} customHex={customHex} now={now} size={size} />
      </Suspense>
    );
  }
  if (style === 'flip') {
    return (
      <Suspense fallback={<ClockFallback style="flip" />}>
        <FlipClock color={c} customHex={customHex} now={now} theme={theme} size={size} soundEnabled={soundEnabled} />
      </Suspense>
    );
  }
  if (style === 'casio') {
    return (
      <Suspense fallback={<ClockFallback style="casio" />}>
        <CasioClock color={c} customHex={customHex} now={now} size={size} />
      </Suspense>
    );
  }

  // Digital (default) — always-on, in the main bundle.
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const hex = getColor(c, customHex);
  const isPlain = (c === 'white' || c === 'ink') && !customHex;
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
// Analog clock — small enough to keep in the main bundle. Just SVG
// + an rAF loop for the smooth second hand.
// --------------------------------------------------------------------------

function AnalogClock({
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
  const size = 280 * getSizeScale(sizeProp);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const hex = getColor(color, customHex);

  // Drive the second hand smoothly with rAF instead of waiting for
  // the 1s parent tick. We capture `now` from props but use a local
  // rAF cycle for the smooth sweep — this is decoupled from the rest
  // of the clock (hour/minute still snap on the 1s tick).
  const [ms, setMs] = useState(() => now.getMilliseconds());
  const startRef = useRef<number>(0);
  const baseNowRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    baseNowRef.current = now.getTime() - now.getMilliseconds();
    startRef.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    baseNowRef.current = now.getTime() - now.getMilliseconds();
    startRef.current = performance.now();
  }, [now]);
  useEffect(() => {
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const derived = (baseNowRef.current + elapsed) % 1000;
      setMs(derived);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const secFraction = s + ms / 1000;

  const hourAngle = ((h + m / 60) * 30 - 90) * (Math.PI / 180);
  const minAngle = ((m + s / 60) * 6 - 90) * (Math.PI / 180);
  const secAngle = (secFraction * 6 - 90) * (Math.PI / 180);

  const hourLen = r * 0.55;
  const minLen = r * 0.8;
  const secLen = r * 0.9;

  const ticks = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
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
  }, [cx, cy, r]);

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
  customHex,
  theme = 'dark',
  cities = DEFAULT_CITIES,
}: {
  color?: ClockColor;
  customHex?: string;
  theme?: ThemeName;
  cities?: { name: string; tz: string }[];
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const c = effectiveClockColor(color);
  const hex = getColor(c, customHex);
  const palette = THEMES[theme];
  const label = palette.textMuted;

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

export function DateDisplay({
  theme = 'dark',
  locale = 'en-US',
  format = 'long',
}: {
  theme?: ThemeName;
  /** BCP-47 locale tag, e.g. 'en-US' or 'id-ID'. */
  locale?: string;
  /** 'long' = "Senin, 16 Juni 2026"; 'iso' = "2026-06-16"; 'short' = "Mon, Jun 16". */
  format?: 'long' | 'short' | 'iso';
}) {
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

  const dayName = now.toLocaleDateString(locale, { weekday: format === 'short' ? 'short' : 'long' });
  const dateStr =
    format === 'iso'
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      : now.toLocaleDateString(locale, {
          day: 'numeric',
          month: format === 'short' ? 'short' : 'long',
          year: 'numeric',
        });

  const palette = THEMES[theme];
  const label = palette.textMuted;
  const main = palette.text;
  // Timezone indicator. We render the short form (e.g. "WIB" or
  // "GMT+7") based on what Intl knows about the current zone. Falls
  // back to UTC offset if the locale doesn't expose a zone name.
  const tzName = (() => {
    try {
      const parts = new Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(
        new Date(),
      );
      return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    } catch {
      return '';
    }
  })();

  return (
    <div className="text-center">
      <div className={`text-2xl font-light tracking-wide ${main}`}>{dayName}</div>
      <div className={`text-sm mt-1 ${label}`}>{dateStr}</div>
      {tzName && <div className={`text-[10px] mt-0.5 opacity-60 ${label}`}>{tzName}</div>}
    </div>
  );
}